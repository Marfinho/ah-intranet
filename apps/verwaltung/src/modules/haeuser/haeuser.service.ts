import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { MODULE_DEFINITIONS, getModule, isModuleKey } from "@ah-intranet/shared";
import type { Sitzung } from "../../core/decorators";
import { IntranetService } from "../../core/intranet.service";
import { ProtokollService } from "../../core/protokoll.service";
import { aktiveModule, anteil, fuelleTage, hausHinweise, lizenzAuslastung, modulAenderung } from "../statistik/regeln";

/**
 * Mandanten des Betreibers selbst (Verwaltungs-Mandant) sind keine Kunden und
 * stehen in keiner Auswertung: ein Haus mit Plattformkonten gehört dem Betreiber.
 */
export const NUR_KUNDEN = `NOT EXISTS (SELECT 1 FROM "User" bu WHERE bu."tenantId" = t.id AND bu."isPlatformAdmin")`;

export interface HausZeile {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  isActive: boolean;
  licensedSeats: number | null;
  locationLimit: number | null;
  mfaPflicht: boolean;
  notes: string | null;
  createdAt: Date;
  aktiveKonten: number;
  konten: number;
  standorte: number;
  letzteAnmeldung: Date | null;
  aktiv30: number;
  mitMfa: number;
  letzteAktivitaet: Date | null;
  aktionen7: number;
  aktionen30: number;
}

const LISTE = `
  SELECT t.id, t.slug, t.name, t.domain, t."isActive", t."licensedSeats", t."locationLimit", t."mfaPflicht",
         t.notes, t."createdAt",
         (SELECT count(*) FROM "User" u WHERE u."tenantId" = t.id AND u.status = 'active')::int AS "aktiveKonten",
         (SELECT count(*) FROM "User" u WHERE u."tenantId" = t.id)::int AS konten,
         (SELECT count(*) FROM "Location" l WHERE l."tenantId" = t.id)::int AS standorte,
         (SELECT max(u."lastLoginAt") FROM "User" u WHERE u."tenantId" = t.id) AS "letzteAnmeldung",
         (SELECT count(*) FROM "User" u WHERE u."tenantId" = t.id AND u.status = 'active'
            AND u."lastLoginAt" > now() - interval '30 days')::int AS aktiv30,
         (SELECT count(*) FROM "User" u WHERE u."tenantId" = t.id AND u.status = 'active'
            AND u."totpEnabledAt" IS NOT NULL)::int AS "mitMfa",
         (SELECT max(a."createdAt") FROM "AuditLog" a WHERE a."tenantId" = t.id) AS "letzteAktivitaet",
         (SELECT count(*) FROM "AuditLog" a WHERE a."tenantId" = t.id
            AND a."createdAt" > now() - interval '7 days')::int AS aktionen7,
         (SELECT count(*) FROM "AuditLog" a WHERE a."tenantId" = t.id
            AND a."createdAt" > now() - interval '30 days')::int AS aktionen30
  FROM "Tenant" t`;

/** Je Fachbereich eine Tabelle mit Mandantenspalte und Anlagedatum - nur gezählt, nie gelesen. */
export const NUTZUNG: { key: string; label: string; tabelle: string }[] = [
  { key: "news", label: "Aushänge", tabelle: "NewsPost" },
  { key: "orders", label: "Bestellungen", tabelle: "Order" },
  { key: "tickets", label: "Tickets", tabelle: "Ticket" },
  { key: "documents", label: "Dokumente", tabelle: "Document" },
  { key: "wiki", label: "Wissensartikel", tabelle: "WikiArticle" },
  { key: "calendar", label: "Termine", tabelle: "CalendarEvent" },
  { key: "rooms", label: "Raumbuchungen", tabelle: "RoomBooking" },
  { key: "ideas", label: "Ideen", tabelle: "Idea" },
  { key: "polls", label: "Umfragen", tabelle: "Poll" },
  { key: "onboarding", label: "Einarbeitungen", tabelle: "OnboardingAssignment" },
  { key: "absences", label: "Abwesenheiten", tabelle: "Absence" },
  { key: "shifts", label: "Schichten", tabelle: "Shift" },
  { key: "custody", label: "Fundsachen & Schlüssel", tabelle: "CustodyItem" },
  { key: "meals", label: "Essensbestellungen", tabelle: "MealOrder" },
];

@Injectable()
export class HaeuserService {
  constructor(
    private readonly intranet: IntranetService,
    private readonly protokoll: ProtokollService,
  ) {}

  async liste() {
    const zeilen = await this.intranet.abfrage<HausZeile>(`${LISTE} WHERE ${NUR_KUNDEN} ORDER BY t.name`);
    const modulZeilen = await this.intranet.abfrage<{ tenantId: string; key: string; enabled: boolean }>(
      `SELECT ms."tenantId", ms.key, ms.enabled FROM "ModuleSetting" ms JOIN "Tenant" t ON t.id = ms."tenantId" WHERE ${NUR_KUNDEN}`,
    );
    const nachHaus = new Map<string, { key: string; enabled: boolean }[]>();
    for (const zeile of modulZeilen) {
      nachHaus.set(zeile.tenantId, [...(nachHaus.get(zeile.tenantId) ?? []), zeile]);
    }
    return zeilen.map((zeile) => this.anreichern(zeile, nachHaus.get(zeile.id) ?? []));
  }

  async detail(id: string) {
    const zeile = await this.intranet.eine<HausZeile>(`${LISTE} WHERE t.id = $1 AND ${NUR_KUNDEN}`, [id]);
    if (!zeile) throw new NotFoundException("Haus nicht gefunden");

    const [module, nutzung, aktivitaet, anmeldungen, orte, authAnbieter] = await Promise.all([
      this.intranet.abfrage<{ key: string; enabled: boolean; updatedAt: Date; updatedBy: string | null }>(
        `SELECT key, enabled, "updatedAt", "updatedBy" FROM "ModuleSetting" WHERE "tenantId" = $1`,
        [id],
      ),
      this.nutzung(id),
      this.intranet.abfrage<{ tag: string; n: number }>(
        `SELECT to_char(a."createdAt"::date, 'YYYY-MM-DD') AS tag, count(*)::int AS n FROM "AuditLog" a
          WHERE a."tenantId" = $1 AND a."createdAt" > now() - interval '60 days' GROUP BY 1`,
        [id],
      ),
      this.intranet.abfrage<{ klasse: string; n: number }>(
        `SELECT CASE WHEN "lastLoginAt" IS NULL THEN 'nie'
                     WHEN "lastLoginAt" > now() - interval '1 day' THEN 'heute'
                     WHEN "lastLoginAt" > now() - interval '7 days' THEN 'woche'
                     WHEN "lastLoginAt" > now() - interval '30 days' THEN 'monat'
                     ELSE 'aelter' END AS klasse, count(*)::int AS n
           FROM "User" WHERE "tenantId" = $1 AND status = 'active' GROUP BY 1`,
        [id],
      ),
      this.intranet.abfrage<{ name: string; code: string }>(
        `SELECT name, code FROM "Location" WHERE "tenantId" = $1 ORDER BY name`,
        [id],
      ),
      this.intranet.abfrage<{ kind: string; enabled: boolean }>(
        `SELECT kind::text, "isActive" AS enabled FROM "TenantAuthProvider" WHERE "tenantId" = $1`,
        [id],
      ),
    ]);

    const haus = this.anreichern(zeile, module);
    const gesetzt = new Map(module.map((modul) => [modul.key, modul]));
    return {
      ...haus,
      module: MODULE_DEFINITIONS.map((definition) => ({
        key: definition.key,
        label: definition.label,
        group: definition.group,
        core: definition.core,
        stage: definition.stage as string,
        dependsOn: [...definition.dependsOn] as string[],
        enabled: haus.aktiveModule.includes(definition.key),
        geaendertAm: gesetzt.get(definition.key)?.updatedAt ?? null,
        geaendertVon: gesetzt.get(definition.key)?.updatedBy ?? null,
      })),
      nutzung,
      aktivitaet: fuelleTage(aktivitaet, 60),
      anmeldungen: Object.fromEntries(
        ["heute", "woche", "monat", "aelter", "nie"].map((k) => [k, anmeldungen.find((a) => a.klasse === k)?.n ?? 0]),
      ),
      standortNamen: orte,
      anmeldearten: authAnbieter,
    };
  }

  private anreichern(zeile: HausZeile, modulZeilen: { key: string; enabled: boolean }[]) {
    const module = aktiveModule(modulZeilen);
    return {
      ...zeile,
      lizenzAuslastung: lizenzAuslastung(zeile.aktiveKonten, zeile.licensedSeats),
      mfaAnteil: anteil(zeile.mitMfa, zeile.aktiveKonten),
      aktiveModule: module,
      betaModule: module.filter((key) => getModule(key)?.stage === "beta"),
      hinweise: hausHinweise({
        id: zeile.id,
        name: zeile.name,
        isActive: zeile.isActive,
        aktiveKonten: zeile.aktiveKonten,
        licensedSeats: zeile.licensedSeats,
        locationLimit: zeile.locationLimit,
        standorte: zeile.standorte,
        letzteAnmeldung: zeile.letzteAnmeldung,
        mfaPflicht: zeile.mfaPflicht,
        createdAt: zeile.createdAt,
      }),
    };
  }

  /** Wie viele Datensätze je Fachbereich - nur Zahlen, nie Inhalte. */
  private async nutzung(id: string) {
    const teile = NUTZUNG.map(
      (eintrag, i) => `SELECT $${i + 2}::text AS key,
        (SELECT count(*) FROM "${eintrag.tabelle}" WHERE "tenantId" = $1)::int AS gesamt,
        (SELECT count(*) FROM "${eintrag.tabelle}" WHERE "tenantId" = $1 AND "createdAt" > now() - interval '30 days')::int AS monat`,
    );
    const zeilen = await this.intranet.abfrage<{ key: string; gesamt: number; monat: number }>(
      teile.join(" UNION ALL "),
      [id, ...NUTZUNG.map((eintrag) => eintrag.key)],
    );
    return NUTZUNG.map((eintrag) => ({ ...eintrag, ...zeilen.find((zeile) => zeile.key === eintrag.key)! }));
  }

  /* ----------------------------------------------------- Änderungen */

  async setzeAktiv(wer: Sitzung, id: string, aktiv: boolean) {
    const haus = await this.hole(id);
    await this.intranet.abfrage(`UPDATE "Tenant" SET "isActive" = $2, "updatedAt" = now() WHERE id = $1`, [id, aktiv]);
    await this.protokoll.schreibe(
      wer,
      aktiv ? "haus.freischalten" : "haus.sperren",
      "haus",
      id,
      `${haus.name} ${aktiv ? "freigeschaltet" : "gesperrt"}`,
    );
  }

  async setzeLizenz(wer: Sitzung, id: string, lizenzen: number | null) {
    const haus = await this.hole(id);
    if (lizenzen !== null && lizenzen < 1)
      throw new BadRequestException("Das Lizenzkontingent muss mindestens 1 sein - oder leer für unbegrenzt.");
    await this.intranet.abfrage(`UPDATE "Tenant" SET "licensedSeats" = $2, "updatedAt" = now() WHERE id = $1`, [
      id,
      lizenzen,
    ]);
    await this.protokoll.schreibe(
      wer,
      "haus.lizenz",
      "haus",
      id,
      `${haus.name}: Lizenzkontingent ${lizenzen ?? "unbegrenzt"} (vorher ${haus.licensedSeats ?? "unbegrenzt"})`,
    );
  }

  async setzeStandortlimit(wer: Sitzung, id: string, limit: number | null) {
    const haus = await this.hole(id);
    if (limit !== null && limit < 1)
      throw new BadRequestException("Das Standortlimit muss mindestens 1 sein - oder leer für unbegrenzt.");
    await this.intranet.abfrage(`UPDATE "Tenant" SET "locationLimit" = $2, "updatedAt" = now() WHERE id = $1`, [
      id,
      limit,
    ]);
    await this.protokoll.schreibe(
      wer,
      "haus.standortlimit",
      "haus",
      id,
      `${haus.name}: Standortlimit ${limit ?? "unbegrenzt"} (vorher ${haus.locationLimit ?? "unbegrenzt"})`,
    );
  }

  async setzeNotiz(wer: Sitzung, id: string, notiz: string | null) {
    const haus = await this.hole(id);
    await this.intranet.abfrage(`UPDATE "Tenant" SET notes = $2, "updatedAt" = now() WHERE id = $1`, [
      id,
      notiz?.trim() || null,
    ]);
    await this.protokoll.schreibe(wer, "haus.notiz", "haus", id, `${haus.name}: Notiz geändert`);
  }

  /** Schaltet ein Modul (samt Abhängigkeiten) um; Kernmodule bleiben immer an. */
  async setzeModul(wer: Sitzung, id: string, key: string, an: boolean) {
    const haus = await this.hole(id);
    if (!isModuleKey(key)) throw new NotFoundException(`Unbekanntes Modul: ${key}`);
    const definition = getModule(key)!;
    if (definition.core)
      throw new BadRequestException(`${definition.label} ist ein Kernmodul und kann nicht deaktiviert werden.`);

    const betroffen = modulAenderung(key, an);
    await this.intranet.transaktion(async (client) => {
      for (const [modul, aktiv] of betroffen) {
        await client.query(
          `INSERT INTO "ModuleSetting" ("tenantId", key, enabled, "updatedAt", "updatedBy") VALUES ($1, $2, $3, now(), $4)
           ON CONFLICT ("tenantId", key) DO UPDATE SET enabled = EXCLUDED.enabled, "updatedAt" = now(), "updatedBy" = EXCLUDED."updatedBy"`,
          [id, modul, aktiv, `verwaltung:${wer.username}`],
        );
      }
    });
    await this.protokoll.schreibe(
      wer,
      an ? "modul.an" : "modul.aus",
      "haus",
      id,
      `${haus.name}: ${definition.label} ${an ? "eingeschaltet" : "ausgeschaltet"}${betroffen.size > 1 ? ` (mit ${betroffen.size - 1} abhängigen)` : ""}`,
    );
    return [...betroffen].map(([modul, aktiv]) => ({ key: modul, enabled: aktiv }));
  }

  private async hole(id: string) {
    const haus = await this.intranet.eine<{
      id: string;
      name: string;
      licensedSeats: number | null;
      locationLimit: number | null;
    }>(`SELECT t.id, t.name, t."licensedSeats", t."locationLimit" FROM "Tenant" t WHERE t.id = $1 AND ${NUR_KUNDEN}`, [
      id,
    ]);
    if (!haus) throw new NotFoundException("Haus nicht gefunden");
    return haus;
  }
}
