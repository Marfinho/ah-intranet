import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  BETRIEBSTAG_ARTEN,
  betriebstagArt,
  type BetriebskalenderAnsicht,
  type BetriebstagArt,
  type BetriebstagEintrag,
  type BetriebstagVorschlag,
} from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import type { RequestUser } from "../../core/request-user";
import { brueckentage, feiertage } from "./feiertage";

export interface BetriebstagInput {
  datum: string;
  art: BetriebstagArt;
  name: string;
  arbeitsfrei?: boolean;
  locationId?: string | null;
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Betriebskalender des Hauses: Feiertage, Brückentage, verkaufsoffene Sonntage,
 * Betriebsurlaub.
 *
 * Feiertage sind ein **Vorschlag** aus der Rechnung (`feiertage.ts`). Erst die
 * Übernahme macht sie zu Einträgen des Hauses - und damit änderbar. Eine
 * Rechnung, die sich nicht korrigieren ließe, läge bei jedem Ortsfeiertag falsch.
 */
@Injectable()
export class BetriebskalenderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Für alle angemeldeten Konten: die Tage des Jahres, die Planung und Anträge betreffen. */
  async tage(jahr: number): Promise<BetriebstagEintrag[]> {
    const rows = await this.prisma.betriebstag.findMany({
      where: { datum: { gte: this.jahresbeginn(jahr), lt: this.jahresbeginn(jahr + 1) } },
      orderBy: [{ datum: "asc" }, { name: "asc" }],
    });
    return rows.map((row) => this.toEintrag(row));
  }

  /** Für die Pflege: Einträge plus die Vorschläge, die das Haus noch nicht übernommen hat. */
  async ansicht(jahr: number): Promise<BetriebskalenderAnsicht> {
    const [standorte, eintraege] = await Promise.all([
      this.prisma.location.findMany({ select: { id: true, name: true, bundesland: true }, orderBy: { name: "asc" } }),
      this.tage(jahr),
    ]);

    const vorschlaege: BetriebstagVorschlag[] = [];
    for (const standort of standorte) {
      if (!standort.bundesland) {
        continue;
      }
      const feste = feiertage(jahr, standort.bundesland);
      const kandidaten = [
        ...feste.map((tag) => ({ ...tag, art: "feiertag" as const })),
        ...brueckentage(feste).map((tag) => ({ ...tag, art: "brueckentag" as const })),
      ];
      for (const kandidat of kandidaten) {
        // Schon geführt (für diesen Standort oder das ganze Haus), gleich unter welchem Namen:
        // ein zweiter Eintrag für denselben Tag wäre doppelte Pflege.
        const vorhanden = eintraege.some(
          (eintrag) => eintrag.datum === kandidat.datum && (eintrag.locationId === standort.id || eintrag.locationId === null),
        );
        if (!vorhanden) {
          vorschlaege.push({
            locationId: standort.id,
            datum: kandidat.datum,
            art: kandidat.art,
            name: kandidat.name,
            arbeitsfrei: betriebstagArt(kandidat.art)!.arbeitsfreiStandard,
          });
        }
      }
    }
    vorschlaege.sort((a, b) => a.datum.localeCompare(b.datum));

    return { jahr, standorte, eintraege, vorschlaege };
  }

  /** Übernimmt Vorschläge der gewählten Arten - ohne Angabe nur Feiertage, Brückentage bleiben Entscheidung des Hauses. */
  async uebernehmen(
    actor: RequestUser,
    input: { jahr: number; locationId?: string; arten?: BetriebstagArt[] },
  ): Promise<BetriebskalenderAnsicht> {
    const arten = input.arten?.length ? input.arten : (["feiertag"] as BetriebstagArt[]);
    const ansicht = await this.ansicht(input.jahr);
    const auswahl = ansicht.vorschlaege.filter(
      (vorschlag) => arten.includes(vorschlag.art) && (!input.locationId || vorschlag.locationId === input.locationId),
    );
    if (auswahl.length === 0) {
      throw new BadRequestException("Es gibt nichts zu übernehmen. Hinterlegen Sie am Standort das Bundesland.");
    }

    await this.prisma.betriebstag.createMany({
      data: auswahl.map((vorschlag) => ({
        locationId: vorschlag.locationId,
        datum: new Date(`${vorschlag.datum}T00:00:00Z`),
        art: vorschlag.art,
        name: vorschlag.name,
        arbeitsfrei: vorschlag.arbeitsfrei,
      })),
    });

    await this.audit.log({
      actor,
      action: "betriebskalender.uebernommen",
      entityType: "betriebstag",
      entityId: input.locationId ?? "haus",
      detail: `${auswahl.length} Vorschlag/Vorschläge für ${input.jahr} übernommen`,
    });
    return this.ansicht(input.jahr);
  }

  async create(actor: RequestUser, input: BetriebstagInput): Promise<BetriebstagEintrag> {
    const datum = this.datum(input.datum);
    const name = this.name(input.name);
    const art = this.art(input.art);
    const locationId = await this.standort(input.locationId);

    const doppelt = await this.prisma.betriebstag.findFirst({ where: { datum, locationId, name }, select: { id: true } });
    if (doppelt) {
      throw new BadRequestException(`Für diesen Tag gibt es bereits einen Eintrag "${name}".`);
    }

    const row = await this.prisma.betriebstag.create({
      data: { datum, art: art.key, name, locationId, arbeitsfrei: input.arbeitsfrei ?? art.arbeitsfreiStandard },
    });
    await this.audit.log({
      actor,
      action: "betriebskalender.create",
      entityType: "betriebstag",
      entityId: row.id,
      detail: `${art.name} "${name}" am ${input.datum} eingetragen`,
    });
    return this.toEintrag(row);
  }

  async update(
    actor: RequestUser,
    id: string,
    input: Partial<Pick<BetriebstagInput, "name" | "art" | "arbeitsfrei" | "datum">>,
  ): Promise<BetriebstagEintrag> {
    const vorhanden = await this.prisma.betriebstag.findUnique({ where: { id } });
    if (!vorhanden) {
      throw new NotFoundException("Eintrag nicht gefunden");
    }
    const row = await this.prisma.betriebstag.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: this.name(input.name) } : {}),
        ...(input.art !== undefined ? { art: this.art(input.art).key } : {}),
        ...(input.arbeitsfrei !== undefined ? { arbeitsfrei: input.arbeitsfrei } : {}),
        ...(input.datum !== undefined ? { datum: this.datum(input.datum) } : {}),
      },
    });
    await this.audit.log({
      actor,
      action: "betriebskalender.update",
      entityType: "betriebstag",
      entityId: id,
      detail: `Eintrag "${row.name}" geändert`,
    });
    return this.toEintrag(row);
  }

  async remove(actor: RequestUser, id: string): Promise<void> {
    const vorhanden = await this.prisma.betriebstag.findUnique({ where: { id } });
    if (!vorhanden) {
      throw new NotFoundException("Eintrag nicht gefunden");
    }
    await this.prisma.betriebstag.delete({ where: { id } });
    await this.audit.log({
      actor,
      action: "betriebskalender.delete",
      entityType: "betriebstag",
      entityId: id,
      detail: `Eintrag "${vorhanden.name}" gelöscht`,
    });
  }

  /* ---------------------------------------------------------- Helfer */

  private jahresbeginn(jahr: number): Date {
    return new Date(Date.UTC(jahr, 0, 1));
  }

  private datum(text: string): Date {
    const datum = new Date(`${text}T00:00:00Z`);
    if (!DATUM.test(text) || Number.isNaN(datum.getTime()) || datum.toISOString().slice(0, 10) !== text) {
      throw new BadRequestException("Bitte ein gültiges Datum angeben (JJJJ-MM-TT).");
    }
    return datum;
  }

  private name(text: string): string {
    const name = text.trim();
    if (name.length < 2 || name.length > 80) {
      throw new BadRequestException("Der Name braucht 2 bis 80 Zeichen.");
    }
    return name;
  }

  private art(key: string) {
    const art = betriebstagArt(key);
    if (!art) {
      throw new BadRequestException(`Unbekannte Art: ${key}. Möglich: ${BETRIEBSTAG_ARTEN.map((a) => a.key).join(", ")}`);
    }
    return art;
  }

  /** Leer = ganzes Haus. Ein fremder Standort scheitert schon am Mandantenfilter. */
  private async standort(locationId?: string | null): Promise<string | null> {
    if (!locationId) {
      return null;
    }
    const standort = await this.prisma.location.findFirst({ where: { id: locationId }, select: { id: true } });
    if (!standort) {
      throw new BadRequestException("Der Standort existiert in diesem Haus nicht.");
    }
    return standort.id;
  }

  private toEintrag(row: {
    id: string;
    locationId: string | null;
    datum: Date;
    art: BetriebstagArt;
    name: string;
    arbeitsfrei: boolean;
  }): BetriebstagEintrag {
    return {
      id: row.id,
      locationId: row.locationId,
      datum: row.datum.toISOString().slice(0, 10),
      art: row.art,
      name: row.name,
      arbeitsfrei: row.arbeitsfrei,
    };
  }
}
