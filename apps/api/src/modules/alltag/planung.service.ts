import { BadRequestException, Injectable } from "@nestjs/common";
import type { ArbeitszeitBefund, PlanVorschau } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { NotificationsService } from "../../core/notifications.service";
import { displayName } from "../../core/mappers";
import { can, type RequestUser } from "../../core/request-user";
import {
  lokalZuUtc,
  lokaleUhrzeit,
  planeSchichten,
  pruefeArbeitszeit,
  schichtZeitraum,
  tageZwischen,
  type PersonPlan,
  type PlanEingabe,
  type PlanErgebnis,
  type SchichtartRef,
} from "./schichtplanung";

export interface PlanAnfrage {
  von: string;
  bis: string;
  schichtartIds?: string[];
}

const TAG_MS = 86_400_000;
const MAX_TAGE = 42;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function datumText(datum: string): string {
  return new Date(`${datum}T00:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * Autoplanung und Arbeitszeitprüfung.
 *
 * Die Vorschau rechnet nur; erst die Übernahme schreibt Schichten. Beides läuft
 * über dieselbe reine Funktion (`planeSchichten`), und die Übernahme rechnet
 * **neu**, statt dem Browser eine Liste abzunehmen: der Client schickt Zeitraum
 * und Schichtarten, nie Zuweisungen. Ein manipulierter Plan, der an Ruhezeiten
 * oder Abwesenheiten vorbei Schichten setzt, hätte keinen Weg hinein.
 */
@Injectable()
export class PlanungService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ---------------------------------------------------------- Planung */

  async vorschau(anfrage: PlanAnfrage): Promise<PlanVorschau> {
    const { eingabe, arten, personen } = await this.lade(anfrage);
    const ergebnis = planeSchichten(eingabe);
    return this.alsVorschau(anfrage, ergebnis, arten, personen);
  }

  async uebernehmen(user: RequestUser, anfrage: PlanAnfrage): Promise<{ geplant: number; offen: number }> {
    const { eingabe, arten, personen } = await this.lade(anfrage);
    const ergebnis = planeSchichten(eingabe);
    const art = new Map(arten.map((eintrag) => [eintrag.id, eintrag]));
    const person = new Map(personen.map((eintrag) => [eintrag.id, eintrag.plan]));

    // Offene Schichten nur für das, was zur Mindestbesetzung fehlt: Lücken zur Idealbesetzung bleiben Hinweis, sonst
    // füllte sich der Plan mit leeren Karten.
    const offeneSchichten = ergebnis.luecken
      .filter((luecke) => luecke.unterMindest)
      .flatMap((luecke) =>
        Array.from({ length: luecke.mindest - luecke.besetzt }, () => ({ luecke, art: art.get(luecke.schichtartId)! })),
      );

    if (ergebnis.zuweisungen.length === 0 && offeneSchichten.length === 0) {
      throw new BadRequestException(
        "Es gibt nichts zu planen: alle Schichten sind schon besetzt oder niemand kommt in Frage.",
      );
    }

    await this.prisma.shift.createMany({
      data: [
        ...ergebnis.zuweisungen.map((zuweisung) => {
          const vorlage = art.get(zuweisung.schichtartId)!;
          const mitarbeitende = person.get(zuweisung.userId)!;
          return {
            label: vorlage.name,
            startsAt: zuweisung.start,
            endsAt: zuweisung.ende,
            pauseMinuten: zuweisung.pauseMinuten,
            schichtartId: vorlage.id,
            locationId: vorlage.locationId ?? mitarbeitende.locationId,
            departmentId: vorlage.departmentId ?? mitarbeitende.departmentId,
            assigneeId: zuweisung.userId,
            createdById: user.id,
          };
        }),
        ...offeneSchichten.map(({ luecke, art: vorlage }) => {
          const zeitraum = schichtZeitraum(vorlage, luecke.datum);
          return {
            label: vorlage.name,
            startsAt: zeitraum.start,
            endsAt: zeitraum.ende,
            pauseMinuten: vorlage.pauseMinuten,
            schichtartId: vorlage.id,
            locationId: vorlage.locationId,
            departmentId: vorlage.departmentId,
            assigneeId: null,
            createdById: user.id,
          };
        }),
      ],
    });

    await this.audit.log({
      actor: user,
      action: "schichtplan.geplant",
      entityType: "shift",
      entityId: `${anfrage.von}..${anfrage.bis}`,
      detail: `Autoplanung ${anfrage.von} bis ${anfrage.bis}: ${ergebnis.zuweisungen.length} Schicht(en) besetzt, ${offeneSchichten.length} offen`,
    });

    // Eine Nachricht je Person, nicht eine je Schicht.
    const proPerson = new Map<string, number>();
    for (const zuweisung of ergebnis.zuweisungen) {
      proPerson.set(zuweisung.userId, (proPerson.get(zuweisung.userId) ?? 0) + 1);
    }
    for (const [userId, anzahl] of proPerson) {
      if (userId === user.id) {
        continue;
      }
      await this.notifications.notify({
        userIds: [userId],
        title: "Neue Schichten geplant",
        detail: `${anzahl} Schicht(en) von ${datumText(anfrage.von)} bis ${datumText(anfrage.bis)} sind für Sie eingetragen.`,
        link: "/schichtplan",
      });
    }

    return { geplant: ergebnis.zuweisungen.length, offen: offeneSchichten.length };
  }

  /* ----------------------------------------------- Arbeitszeitprüfung */

  /**
   * Markiert Verstöße und Hinweise nach dem Arbeitszeitgesetz im Zeitraum.
   * Wer den Plan pflegt, sieht alle; alle anderen nur die eigenen Befunde.
   */
  async pruefung(user: RequestUser, von: string, bis: string): Promise<ArbeitszeitBefund[]> {
    this.pruefeZeitraum(von, bis);
    const vonUtc = lokalZuUtc(von, 0);
    // Einen Tag Vorlauf und Nachlauf: die Ruhezeit hängt an der Schicht davor.
    const rows = await this.prisma.shift.findMany({
      where: {
        assigneeId: user && can(user, "shifts.manage") ? { not: null } : user.id,
        startsAt: { gte: new Date(vonUtc.getTime() - TAG_MS), lte: new Date(lokalZuUtc(bis, 1440).getTime() + TAG_MS) },
      },
      select: {
        assigneeId: true,
        startsAt: true,
        endsAt: true,
        pauseMinuten: true,
        assignee: { select: { firstName: true, lastName: true, wochenstunden: true } },
      },
    });

    const namen = new Map<string, string>();
    const wochenstunden = new Map<string, number | null>();
    for (const row of rows) {
      namen.set(row.assigneeId!, displayName(row.assignee!));
      wochenstunden.set(row.assigneeId!, row.assignee!.wochenstunden);
    }

    return pruefeArbeitszeit(
      rows.map((row) => ({
        userId: row.assigneeId!,
        start: row.startsAt,
        ende: row.endsAt,
        pauseMinuten: row.pauseMinuten,
      })),
      wochenstunden,
    )
      .filter((befund) => befund.datum >= von && befund.datum <= bis)
      .map((befund) => ({ ...befund, name: namen.get(befund.userId) ?? "" }));
  }

  /* ----------------------------------------------------------- Helfer */

  private pruefeZeitraum(von: string, bis: string): void {
    const gueltig = (text: string) =>
      DATUM.test(text) && new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) === text;
    if (!gueltig(von) || !gueltig(bis)) {
      throw new BadRequestException("Bitte einen gültigen Zeitraum angeben (JJJJ-MM-TT).");
    }
    if (bis < von) {
      throw new BadRequestException("Das Ende darf nicht vor dem Beginn liegen.");
    }
    if (tageZwischen(von, bis).length > MAX_TAGE) {
      throw new BadRequestException(`Geplant wird höchstens für ${MAX_TAGE} Tage am Stück.`);
    }
  }

  private async lade(anfrage: PlanAnfrage) {
    this.pruefeZeitraum(anfrage.von, anfrage.bis);
    const vonTag = new Date(`${anfrage.von}T00:00:00Z`);
    const bisTag = new Date(`${anfrage.bis}T00:00:00Z`);

    const [artRows, personRows, schichtRows, abwesenheiten, betriebstage] = await Promise.all([
      this.prisma.schichtart.findMany({
        where: { aktiv: true, ...(anfrage.schichtartIds?.length ? { id: { in: anfrage.schichtartIds } } : {}) },
        orderBy: { name: "asc" },
      }),
      this.prisma.user.findMany({
        where: { status: "active" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          locationId: true,
          departmentId: true,
          managerId: true,
          wochenstunden: true,
          zeitfensterVon: true,
          zeitfensterBis: true,
          arbeitstage: true,
        },
      }),
      this.prisma.shift.findMany({
        where: {
          assigneeId: { not: null },
          // Zwei Tage Rand: Ruhezeit und Wochenstunden hängen an Schichten außerhalb des Zeitraums.
          startsAt: {
            gte: new Date(lokalZuUtc(anfrage.von, 0).getTime() - 7 * TAG_MS),
            lte: new Date(lokalZuUtc(anfrage.bis, 1440).getTime() + 7 * TAG_MS),
          },
        },
        select: { assigneeId: true, startsAt: true, endsAt: true, pauseMinuten: true, schichtartId: true },
      }),
      this.prisma.absence.findMany({
        where: { status: "approved", startDate: { lte: bisTag }, endDate: { gte: vonTag } },
        select: { userId: true, startDate: true, endDate: true },
      }),
      this.prisma.betriebstag.findMany({
        where: { datum: { gte: vonTag, lte: bisTag } },
        select: { datum: true, arbeitsfrei: true, locationId: true },
      }),
    ]);

    if (artRows.length === 0) {
      throw new BadRequestException("Es gibt keine aktive Schichtart zum Planen. Legen Sie zuerst eine an.");
    }

    // Halbe Abwesenheitstage zählen hier als ganze: im Zweifel nicht einplanen.
    const abwesend = new Map<string, Set<string>>();
    for (const eintrag of abwesenheiten) {
      const tage = abwesend.get(eintrag.userId) ?? new Set<string>();
      for (const tag of tageZwischen(
        eintrag.startDate.toISOString().slice(0, 10),
        eintrag.endDate.toISOString().slice(0, 10),
      )) {
        tage.add(tag);
      }
      abwesend.set(eintrag.userId, tage);
    }

    const arten: SchichtartRef[] = artRows;
    const personen = personRows.map((row) => ({
      id: row.id,
      name: displayName(row),
      plan: {
        id: row.id,
        locationId: row.locationId,
        departmentId: row.departmentId,
        managerId: row.managerId,
        wochenstunden: row.wochenstunden,
        zeitfensterVon: row.zeitfensterVon,
        zeitfensterBis: row.zeitfensterBis,
        arbeitstage: row.arbeitstage,
      } satisfies PersonPlan,
    }));

    const eingabe: PlanEingabe = {
      von: anfrage.von,
      bis: anfrage.bis,
      arten,
      personen: personen.map((person) => person.plan),
      vorhanden: schichtRows.map((row) => ({
        userId: row.assigneeId!,
        start: row.startsAt,
        ende: row.endsAt,
        pauseMinuten: row.pauseMinuten,
        schichtartId: row.schichtartId,
      })),
      abwesend,
      betriebstage: betriebstage.map((tag) => ({
        datum: tag.datum.toISOString().slice(0, 10),
        arbeitsfrei: tag.arbeitsfrei,
        locationId: tag.locationId,
      })),
    };
    return { eingabe, arten, personen };
  }

  private alsVorschau(
    anfrage: PlanAnfrage,
    ergebnis: PlanErgebnis,
    arten: SchichtartRef[],
    personen: { id: string; name: string; plan: PersonPlan }[],
  ): PlanVorschau {
    const artName = new Map(arten.map((art) => [art.id, art.name]));
    const personName = new Map(personen.map((person) => [person.id, person.name]));
    const eingeteilt = new Set(ergebnis.zuweisungen.map((zuweisung) => zuweisung.userId));

    return {
      von: anfrage.von,
      bis: anfrage.bis,
      zuweisungen: ergebnis.zuweisungen.map((zuweisung) => ({
        schichtartId: zuweisung.schichtartId,
        schichtart: artName.get(zuweisung.schichtartId) ?? "",
        datum: zuweisung.datum,
        start: lokaleUhrzeit(zuweisung.start),
        ende: lokaleUhrzeit(zuweisung.ende),
        userId: zuweisung.userId,
        name: personName.get(zuweisung.userId) ?? "",
      })),
      luecken: ergebnis.luecken.map((luecke) => ({
        schichtartId: luecke.schichtartId,
        schichtart: artName.get(luecke.schichtartId) ?? "",
        datum: luecke.datum,
        soll: luecke.soll,
        mindest: luecke.mindest,
        besetzt: luecke.besetzt,
        unterMindest: luecke.unterMindest,
      })),
      ohneWochenstunden: personen
        .filter((person) => eingeteilt.has(person.id) && person.plan.wochenstunden === null)
        .map((person) => person.name),
    };
  }
}
