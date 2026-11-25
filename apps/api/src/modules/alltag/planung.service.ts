import { BadRequestException, Injectable } from "@nestjs/common";
import type { ArbeitszeitBefund } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { displayName } from "../../core/mappers";
import { can, type RequestUser } from "../../core/request-user";
import {
  lokalZuUtc,
  pruefeArbeitszeit,
  tageZwischen,
  type PersonPlan,
  type PlanEingabe,
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

/**
 * Grundlagen der Planung: lädt die Daten für die Autoplanung und prüft einen
 * Zeitraum gegen das Arbeitszeitgesetz.
 *
 * Geplant und veröffentlicht wird im Entwurf (`EntwurfService`): der Plan
 * ändert sich nie, ohne dass jemand „speichern" gedrückt hat.
 */
@Injectable()
export class PlanungService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

  pruefeZeitraum(von: string, bis: string): void {
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

  /**
   * Lädt, was die Autoplanung braucht: aktive Schichtarten, Personen, Abwesenheiten, Betriebskalender.
   * Öffentlich, weil der Entwurf die Planung mit seinem eigenen Stand von „vorhandenen" Schichten füttert.
   */
  async lade(anfrage: PlanAnfrage) {
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
}
