import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  EntwurfKonflikt,
  EntwurfPruefung,
  EntwurfSpeicherung,
  EntwurfVorschlag,
  PlanEntwurf,
  PlanEntwurfBasis,
  PlanEntwurfItem,
  PlanEntwurfKopf,
  Veroeffentlichung,
} from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { NotificationsService } from "../../core/notifications.service";
import { displayName } from "../../core/mappers";
import type { RequestUser } from "../../core/request-user";
import { PlanungService } from "./planung.service";
import { ermittleAnwendung, meldungenJePerson, zeitText, type LiveSchicht } from "./plananwendung";
import { findeAlleUeberschneidungen, type SchichtZeit } from "./regeln";
import { lokalZuUtc, lokalesDatum, planeSchichten, pruefeArbeitszeit, schichtZeitraum } from "./schichtplanung";

const TAG_MS = 86_400_000;
const MAX_ITEMS = 500;

export interface EntwurfEingabe {
  name?: string;
  von: string;
  bis: string;
  basis: PlanEntwurfBasis;
}

/**
 * Plan-Entwürfe: ein Dienstplan in Arbeit, getrennt vom echten Plan.
 *
 * Die Teamleitung baut aus einem leeren Blatt (oder einer Kopie des Bestands)
 * einen Entwurf, lässt die Autoplanung befüllen, zieht und teilt ein, speichert
 * zwischendurch den Entwurf - und drückt erst am Ende „Plan speichern". Bis
 * dahin ändert sich der echte Plan nie, und niemand erhält eine Meldung. Beim
 * Veröffentlichen wird alles in einem Zug angewendet, und jede betroffene Person
 * erfährt es **einmal**.
 */
@Injectable()
export class EntwurfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly planung: PlanungService,
  ) {}

  /* ------------------------------------------------------------ Verwalten */

  async liste(von: string, bis: string): Promise<PlanEntwurfKopf[]> {
    this.planung.pruefeZeitraum(von, bis);
    const rows = await this.prisma.planentwurf.findMany({
      where: { von: { lte: new Date(`${bis}T00:00:00Z`) }, bis: { gte: new Date(`${von}T00:00:00Z`) } },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        updatedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => this.toKopf(row));
  }

  async erstelle(user: RequestUser, eingabe: EntwurfEingabe): Promise<PlanEntwurf> {
    this.planung.pruefeZeitraum(eingabe.von, eingabe.bis);
    if (eingabe.basis !== "leer" && eingabe.basis !== "bestand") {
      throw new BadRequestException("Der Entwurf beginnt mit einem leeren Blatt oder dem bestehenden Plan.");
    }

    // Beim Start aus dem Bestand: jede echte Schicht des Zeitraums wird zu einem Element des Entwurfs.
    const items: PlanEntwurfItem[] =
      eingabe.basis === "bestand"
        ? (
            await this.prisma.shift.findMany({
              where: {
                startsAt: { gte: lokalZuUtc(eingabe.von, 0), lt: lokalZuUtc(eingabe.bis, 1440) },
              },
              orderBy: { startsAt: "asc" },
            })
          ).map((shift) => ({
            key: randomUUID(),
            liveId: shift.id,
            liveStand: shift.updatedAt.toISOString(),
            label: shift.label,
            startsAt: shift.startsAt.toISOString(),
            endsAt: shift.endsAt.toISOString(),
            pauseMinuten: shift.pauseMinuten,
            assigneeId: shift.assigneeId,
            schichtartId: shift.schichtartId,
            locationId: shift.locationId,
            departmentId: shift.departmentId,
            note: shift.note,
          }))
        : [];

    const name = eingabe.name?.trim() || `Entwurf ${this.kurz(eingabe.von)} – ${this.kurz(eingabe.bis)}`;
    const row = await this.prisma.planentwurf.create({
      data: {
        name: name.slice(0, 80),
        von: new Date(`${eingabe.von}T00:00:00Z`),
        bis: new Date(`${eingabe.bis}T00:00:00Z`),
        basis: eingabe.basis,
        daten: items as unknown as object,
        createdById: user.id,
        updatedById: user.id,
      },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        updatedBy: { select: { firstName: true, lastName: true } },
      },
    });
    await this.audit.log({
      actor: user,
      action: "planentwurf.create",
      entityType: "planentwurf",
      entityId: row.id,
      detail: `Plan-Entwurf "${row.name}" begonnen (${eingabe.basis === "leer" ? "leeres Blatt" : `${items.length} Schicht(en) aus dem Plan`})`,
    });
    return { ...this.toKopf(row), items };
  }

  async lade(id: string): Promise<PlanEntwurf> {
    const row = await this.prisma.planentwurf.findUnique({
      where: { id },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        updatedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!row) {
      throw new NotFoundException("Entwurf nicht gefunden");
    }
    return { ...this.toKopf(row), items: this.items(row.daten) };
  }

  /**
   * Speichert den Entwurf - **ohne** Wirkung auf den Plan und ohne Meldung.
   * Wer einen veralteten Stand speichern will, wird abgewiesen: zwei Personen am
   * selben Entwurf überschrieben sich sonst stillschweigend.
   */
  async speichere(
    user: RequestUser,
    id: string,
    eingabe: { version: number; name?: string; items: PlanEntwurfItem[] },
  ): Promise<EntwurfSpeicherung> {
    const vorhanden = await this.prisma.planentwurf.findUnique({ where: { id } });
    if (!vorhanden) {
      throw new NotFoundException("Entwurf nicht gefunden");
    }
    const von = vorhanden.von.toISOString().slice(0, 10);
    const bis = vorhanden.bis.toISOString().slice(0, 10);
    await this.pruefeItems(eingabe.items, von, bis);

    const ergebnis = await this.prisma.planentwurf.updateMany({
      where: { id, version: eingabe.version },
      data: {
        daten: eingabe.items as unknown as object,
        version: { increment: 1 },
        updatedById: user.id,
        ...(eingabe.name?.trim() ? { name: eingabe.name.trim().slice(0, 80) } : {}),
      },
    });
    if (ergebnis.count === 0) {
      throw new ConflictException(
        "Dieser Entwurf wurde inzwischen von jemand anderem geändert. Bitte laden Sie ihn neu, sonst überschreiben Sie die andere Fassung.",
      );
    }
    const neu = await this.prisma.planentwurf.findUniqueOrThrow({
      where: { id },
      select: { version: true, updatedAt: true },
    });
    return {
      version: neu.version,
      aktualisiertAm: neu.updatedAt.toISOString(),
      ...(await this.pruefe(von, bis, eingabe.items)),
    };
  }

  async loesche(user: RequestUser, id: string): Promise<void> {
    const vorhanden = await this.prisma.planentwurf.findUnique({ where: { id } });
    if (!vorhanden) {
      throw new NotFoundException("Entwurf nicht gefunden");
    }
    await this.prisma.planentwurf.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: "planentwurf.delete",
      entityType: "planentwurf",
      entityId: id,
      detail: `Plan-Entwurf "${vorhanden.name}" verworfen`,
    });
  }

  /* --------------------------------------------------------- Autoplanung */

  /**
   * Autoplanung im Entwurf: berechnet Schichten und gibt sie zurück, **ohne** etwas zu speichern.
   *
   * Der Browser schickt seinen aktuellen Entwurf mit - auch Ungespeichertes
   * zählt. Offene Elemente der geplanten Schichtarten ersetzt der Vorschlag, damit
   * eine Lücke nicht doppelt auftaucht; was die Planung nicht besetzen kann,
   * kommt als offene Schicht und als Lücke zurück.
   */
  async vorschlag(anfrage: {
    von: string;
    bis: string;
    schichtartIds?: string[];
    items: PlanEntwurfItem[];
  }): Promise<EntwurfVorschlag> {
    const { eingabe, arten, personen } = await this.planung.lade({
      von: anfrage.von,
      bis: anfrage.bis,
      schichtartIds: anfrage.schichtartIds,
    });
    await this.pruefeItems(anfrage.items, anfrage.von, anfrage.bis);

    const geplant = new Set(arten.map((art) => art.id));
    const aktive = anfrage.items.filter((item) => !item.geloescht);
    const fest = await this.ladeFest(anfrage.von, anfrage.bis, anfrage.items);

    const ergebnis = planeSchichten({
      ...eingabe,
      vorhanden: [
        ...fest.map((schicht) => ({
          userId: schicht.assigneeId!,
          start: schicht.startsAt,
          ende: schicht.endsAt,
          pauseMinuten: schicht.pauseMinuten,
          schichtartId: schicht.schichtartId,
        })),
        ...aktive
          .filter((item) => item.assigneeId)
          .map((item) => ({
            userId: item.assigneeId!,
            start: new Date(item.startsAt),
            ende: new Date(item.endsAt),
            pauseMinuten: item.pauseMinuten,
            schichtartId: item.schichtartId,
          })),
      ],
    });

    const art = new Map(arten.map((eintrag) => [eintrag.id, eintrag]));
    const person = new Map(personen.map((eintrag) => [eintrag.id, eintrag]));

    const neu: PlanEntwurfItem[] = ergebnis.zuweisungen.map((zuweisung) => {
      const vorlage = art.get(zuweisung.schichtartId)!;
      const mitarbeitende = person.get(zuweisung.userId)!.plan;
      return {
        key: randomUUID(),
        liveId: null,
        liveStand: null,
        label: vorlage.name,
        startsAt: zuweisung.start.toISOString(),
        endsAt: zuweisung.ende.toISOString(),
        pauseMinuten: zuweisung.pauseMinuten,
        assigneeId: zuweisung.userId,
        schichtartId: vorlage.id,
        locationId: vorlage.locationId ?? mitarbeitende.locationId,
        departmentId: vorlage.departmentId ?? mitarbeitende.departmentId,
        note: null,
      };
    });

    // Lücken zur Mindestbesetzung als offene Schichten, damit sie im Plan sichtbar sind.
    for (const luecke of ergebnis.luecken.filter((eintrag) => eintrag.unterMindest)) {
      const vorlage = art.get(luecke.schichtartId)!;
      const zeitraum = schichtZeitraum(vorlage, luecke.datum);
      for (let i = 0; i < luecke.mindest - luecke.besetzt; i += 1) {
        neu.push({
          key: randomUUID(),
          liveId: null,
          liveStand: null,
          label: vorlage.name,
          startsAt: zeitraum.start.toISOString(),
          endsAt: zeitraum.ende.toISOString(),
          pauseMinuten: vorlage.pauseMinuten,
          assigneeId: null,
          schichtartId: vorlage.id,
          locationId: vorlage.locationId,
          departmentId: vorlage.departmentId,
          note: null,
        });
      }
    }

    const eingeteilt = new Set(ergebnis.zuweisungen.map((zuweisung) => zuweisung.userId));
    return {
      neu,
      entfernen: aktive
        .filter((item) => !item.assigneeId && item.schichtartId && geplant.has(item.schichtartId))
        .map((item) => item.key),
      luecken: ergebnis.luecken.map((luecke) => ({
        schichtartId: luecke.schichtartId,
        schichtart: art.get(luecke.schichtartId)?.name ?? "",
        datum: luecke.datum,
        soll: luecke.soll,
        mindest: luecke.mindest,
        besetzt: luecke.besetzt,
        unterMindest: luecke.unterMindest,
      })),
      ohneWochenstunden: personen
        .filter((eintrag) => eingeteilt.has(eintrag.id) && eintrag.plan.wochenstunden === null)
        .map((eintrag) => eintrag.name),
    };
  }

  /* ------------------------------------------------------ Veröffentlichen */

  /**
   * Wendet den Entwurf auf den echten Plan an - **das** ist „Plan speichern".
   *
   * Alles oder nichts: scheitert eine Prüfung, bleibt der Plan unberührt und der
   * Entwurf stehen. Jede betroffene Person bekommt eine Meldung mit allem, was sich für sie ändert.
   */
  async veroeffentliche(user: RequestUser, id: string, version: number): Promise<Veroeffentlichung> {
    const entwurf = await this.prisma.planentwurf.findUnique({ where: { id } });
    if (!entwurf) {
      throw new NotFoundException("Entwurf nicht gefunden");
    }
    if (entwurf.version !== version) {
      throw new ConflictException(
        "Der Entwurf hat sich geändert. Bitte speichern Sie ihn zuerst und versuchen Sie es erneut.",
      );
    }
    const von = entwurf.von.toISOString().slice(0, 10);
    const bis = entwurf.bis.toISOString().slice(0, 10);
    const items = this.items(entwurf.daten);
    await this.pruefeItems(items, von, bis);

    const liveIds = items.map((item) => item.liveId).filter((eintrag): eintrag is string => Boolean(eintrag));
    const live: LiveSchicht[] = await this.prisma.shift.findMany({
      where: { id: { in: liveIds } },
      select: {
        id: true,
        label: true,
        startsAt: true,
        endsAt: true,
        assigneeId: true,
        pauseMinuten: true,
        note: true,
        updatedAt: true,
      },
    });
    const anwendung = ermittleAnwendung(live, items);

    if (anwendung.verschwunden.length > 0 || anwendung.veraltet.length > 0) {
      const namen = anwendung.veraltet.map(
        (schicht) => `"${schicht.label}" (${zeitText(schicht.startsAt, schicht.endsAt)})`,
      );
      throw new ConflictException(
        `Seit Beginn dieses Entwurfs wurde im Plan geändert, was der Entwurf auch ändern will: ` +
          `${[...namen, ...(anwendung.verschwunden.length ? [`${anwendung.verschwunden.length} gelöschte Schicht(en)`] : [])].join(", ")}. ` +
          "Es wurde nichts gespeichert. Setzen Sie diese Schichten im Entwurf zurück oder beginnen Sie neu.",
      );
    }
    if (anwendung.anlegen.length + anwendung.aendern.length + anwendung.loeschen.length === 0) {
      throw new BadRequestException("Der Entwurf enthält keine Änderungen gegenüber dem Plan.");
    }

    const pruefung = await this.pruefe(von, bis, items);
    if (pruefung.konflikte.length > 0) {
      throw new BadRequestException(
        `Der Entwurf enthält ${pruefung.konflikte.length} Überschneidung(en) derselben Person, zum Beispiel: ${pruefung.konflikte[0].text} ` +
          "Es wurde nichts gespeichert.",
      );
    }

    // Verweise, die nicht (mehr) existieren, würden an der Fremdschlüssel-Prüfung scheitern - vorher sauber abfangen.
    const gueltig = await this.referenzen(items);
    const ref = (wert: string | null, menge: Set<string>) => (wert && menge.has(wert) ? wert : null);
    const person = (wert: string | null) => {
      if (wert && !gueltig.personen.has(wert)) {
        throw new BadRequestException("Eine eingeteilte Person ist nicht mehr aktiv. Bitte im Entwurf neu einteilen.");
      }
      return wert;
    };

    await this.prisma.$transaction([
      ...(anwendung.loeschen.length > 0
        ? [this.prisma.shift.deleteMany({ where: { id: { in: anwendung.loeschen.map((schicht) => schicht.id) } } })]
        : []),
      ...anwendung.aendern.map(({ item, live: echt }) =>
        this.prisma.shift.update({
          where: { id: echt.id },
          data: {
            label: item.label,
            startsAt: new Date(item.startsAt),
            endsAt: new Date(item.endsAt),
            pauseMinuten: item.pauseMinuten,
            assigneeId: person(item.assigneeId),
            note: item.note,
          },
        }),
      ),
      ...(anwendung.anlegen.length > 0
        ? [
            this.prisma.shift.createMany({
              data: anwendung.anlegen.map((item) => ({
                label: item.label,
                startsAt: new Date(item.startsAt),
                endsAt: new Date(item.endsAt),
                pauseMinuten: item.pauseMinuten,
                schichtartId: ref(item.schichtartId, gueltig.arten),
                locationId: ref(item.locationId, gueltig.standorte),
                departmentId: ref(item.departmentId, gueltig.abteilungen),
                assigneeId: person(item.assigneeId),
                note: item.note,
                createdById: user.id,
              })),
            }),
          ]
        : []),
      this.prisma.planentwurf.delete({ where: { id } }),
    ]);

    await this.audit.log({
      actor: user,
      action: "planentwurf.veroeffentlicht",
      entityType: "planentwurf",
      entityId: id,
      detail: `Plan-Entwurf "${entwurf.name}" gespeichert: ${anwendung.anlegen.length} neu, ${anwendung.aendern.length} geändert, ${anwendung.loeschen.length} entfernt`,
    });

    // Erst jetzt, und eine Meldung je Person.
    const meldungen = meldungenJePerson(anwendung);
    let benachrichtigt = 0;
    for (const [userId, zeilen] of meldungen) {
      if (userId === user.id) {
        continue;
      }
      await this.notifications.notify({
        userIds: [userId],
        title: "Schichtplan aktualisiert",
        detail: `${zeilen.slice(0, 8).join("\n")}${zeilen.length > 8 ? `\n… und ${zeilen.length - 8} weitere` : ""}`,
        link: "/schichtplan/woche",
        auchPerMail: true,
      });
      benachrichtigt += 1;
    }

    return {
      angelegt: anwendung.anlegen.length,
      geaendert: anwendung.aendern.length,
      entfernt: anwendung.loeschen.length,
      benachrichtigt,
    };
  }

  /* ----------------------------------------------------------- Prüfung */

  /** Echte, zugeteilte Schichten rund um den Zeitraum, die der Entwurf nicht ersetzt - sie bleiben, wie sie sind. */
  private async ladeFest(von: string, bis: string, items: readonly PlanEntwurfItem[]) {
    const ersetzt = new Set(items.map((item) => item.liveId).filter((eintrag): eintrag is string => Boolean(eintrag)));
    const rows = await this.prisma.shift.findMany({
      where: {
        assigneeId: { not: null },
        startsAt: {
          gte: new Date(lokalZuUtc(von, 0).getTime() - 7 * TAG_MS),
          lte: new Date(lokalZuUtc(bis, 1440).getTime() + 7 * TAG_MS),
        },
      },
      select: {
        id: true,
        label: true,
        assigneeId: true,
        startsAt: true,
        endsAt: true,
        pauseMinuten: true,
        schichtartId: true,
      },
    });
    return rows.filter((row) => !ersetzt.has(row.id));
  }

  /** Überschneidungen und Arbeitszeithinweise im **Endzustand** des Entwurfs. */
  private async pruefe(von: string, bis: string, items: readonly PlanEntwurfItem[]): Promise<EntwurfPruefung> {
    const fest = await this.ladeFest(von, bis, items);
    const aktive = items.filter((item) => !item.geloescht && item.assigneeId);

    const endzustand: SchichtZeit[] = [
      ...fest.map((schicht) => ({
        id: schicht.id,
        label: schicht.label,
        assigneeId: schicht.assigneeId,
        startsAt: schicht.startsAt,
        endsAt: schicht.endsAt,
      })),
      ...aktive.map((item) => ({
        id: item.key,
        label: item.label,
        assigneeId: item.assigneeId,
        startsAt: new Date(item.startsAt),
        endsAt: new Date(item.endsAt),
      })),
    ];
    const konflikte: EntwurfKonflikt[] = findeAlleUeberschneidungen(
      endzustand,
      new Set(aktive.map((item) => item.key)),
    ).map(({ erste, zweite }) => ({
      a: erste.id,
      b: zweite.id,
      text: `"${erste.label}" (${zeitText(erste.startsAt, erste.endsAt)}) und "${zweite.label}" (${zeitText(zweite.startsAt, zweite.endsAt)})`,
    }));

    const personen = [...new Set(endzustand.map((schicht) => schicht.assigneeId!))];
    const rows = personen.length
      ? await this.prisma.user.findMany({
          where: { id: { in: personen } },
          select: { id: true, firstName: true, lastName: true, wochenstunden: true },
        })
      : [];
    const namen = new Map(rows.map((row) => [row.id, displayName(row)]));
    const befunde = pruefeArbeitszeit(
      [
        ...fest.map((schicht) => ({
          userId: schicht.assigneeId!,
          start: schicht.startsAt,
          ende: schicht.endsAt,
          pauseMinuten: schicht.pauseMinuten,
        })),
        ...aktive.map((item) => ({
          userId: item.assigneeId!,
          start: new Date(item.startsAt),
          ende: new Date(item.endsAt),
          pauseMinuten: item.pauseMinuten,
        })),
      ],
      new Map(rows.map((row) => [row.id, row.wochenstunden])),
    )
      .filter((befund) => befund.datum >= von && befund.datum <= bis)
      .map((befund) => ({ ...befund, name: namen.get(befund.userId) ?? "" }));

    return { befunde, konflikte };
  }

  /** Strukturprüfung der Elemente - der Browser ist keine vertrauenswürdige Quelle. */
  private async pruefeItems(items: readonly PlanEntwurfItem[], von: string, bis: string): Promise<void> {
    if (items.length > MAX_ITEMS) {
      throw new BadRequestException(`Ein Entwurf fasst höchstens ${MAX_ITEMS} Schichten.`);
    }
    const schluessel = new Set<string>();
    const echte = new Set<string>();
    for (const item of items) {
      if (!item.key || item.key.length > 64 || schluessel.has(item.key)) {
        throw new BadRequestException("Ein Element des Entwurfs hat keine eindeutige Kennung.");
      }
      schluessel.add(item.key);
      if (item.liveId) {
        if (echte.has(item.liveId)) {
          throw new BadRequestException("Eine echte Schicht steht mehrfach im Entwurf.");
        }
        echte.add(item.liveId);
      }
      const start = new Date(item.startsAt);
      const ende = new Date(item.endsAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(ende.getTime()) || ende <= start) {
        throw new BadRequestException(`Das Ende der Schicht "${item.label}" muss nach dem Beginn liegen.`);
      }
      const tag = lokalesDatum(start);
      if (tag < von || tag > bis) {
        throw new BadRequestException(`Die Schicht "${item.label}" liegt außerhalb des Zeitraums dieses Entwurfs.`);
      }
      if (item.label.trim().length < 2 || item.label.length > 80) {
        throw new BadRequestException("Die Bezeichnung einer Schicht braucht 2 bis 80 Zeichen.");
      }
      if (!Number.isInteger(item.pauseMinuten) || item.pauseMinuten < 0 || item.pauseMinuten > 240) {
        throw new BadRequestException("Die Pause liegt zwischen 0 und 240 Minuten.");
      }
    }
    // Nur existierende, aktive Personen einteilen; fremde Kennungen scheitern schon am Mandantenfilter.
    const personen = [
      ...new Set(items.map((item) => item.assigneeId).filter((eintrag): eintrag is string => Boolean(eintrag))),
    ];
    if (personen.length > 0) {
      const gefunden = await this.prisma.user.count({ where: { id: { in: personen }, status: "active" } });
      if (gefunden !== personen.length) {
        throw new BadRequestException(
          "Mindestens eine eingeteilte Person gibt es nicht oder sie ist nicht mehr aktiv.",
        );
      }
    }
  }

  private async referenzen(items: readonly PlanEntwurfItem[]) {
    const ids = (feld: "schichtartId" | "locationId" | "departmentId" | "assigneeId") => [
      ...new Set(items.map((item) => item[feld]).filter((eintrag): eintrag is string => Boolean(eintrag))),
    ];
    const [arten, standorte, abteilungen, personen] = await Promise.all([
      this.prisma.schichtart.findMany({ where: { id: { in: ids("schichtartId") } }, select: { id: true } }),
      this.prisma.location.findMany({ where: { id: { in: ids("locationId") } }, select: { id: true } }),
      this.prisma.department.findMany({ where: { id: { in: ids("departmentId") } }, select: { id: true } }),
      this.prisma.user.findMany({ where: { id: { in: ids("assigneeId") }, status: "active" }, select: { id: true } }),
    ]);
    return {
      arten: new Set(arten.map((eintrag) => eintrag.id)),
      standorte: new Set(standorte.map((eintrag) => eintrag.id)),
      abteilungen: new Set(abteilungen.map((eintrag) => eintrag.id)),
      personen: new Set(personen.map((eintrag) => eintrag.id)),
    };
  }

  /* ----------------------------------------------------------- Helfer */

  private items(daten: unknown): PlanEntwurfItem[] {
    return Array.isArray(daten) ? (daten as PlanEntwurfItem[]) : [];
  }

  private kurz(datum: string): string {
    return `${datum.slice(8)}.${datum.slice(5, 7)}.`;
  }

  private toKopf(row: {
    id: string;
    name: string;
    von: Date;
    bis: Date;
    basis: string;
    version: number;
    updatedAt: Date;
    daten: unknown;
    createdBy: { firstName: string; lastName: string };
    updatedBy: { firstName: string; lastName: string } | null;
  }): PlanEntwurfKopf {
    return {
      id: row.id,
      name: row.name,
      von: row.von.toISOString().slice(0, 10),
      bis: row.bis.toISOString().slice(0, 10),
      basis: row.basis === "bestand" ? "bestand" : "leer",
      version: row.version,
      aktualisiertAm: row.updatedAt.toISOString(),
      aktualisiertVon: row.updatedBy ? displayName(row.updatedBy) : null,
      erstelltVon: displayName(row.createdBy),
      anzahl: this.items(row.daten).filter((item) => !item.geloescht).length,
    };
  }
}
