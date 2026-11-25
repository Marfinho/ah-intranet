import { Injectable } from "@nestjs/common";
import { MODULE_DEFINITIONS } from "@ah-intranet/shared";
import { DatenbankService } from "../../core/datenbank";
import { IntranetService } from "../../core/intranet.service";
import { HaeuserService, NUR_KUNDEN, NUTZUNG } from "../haeuser/haeuser.service";
import { InteressentenService } from "../interessenten/interessenten.service";
import { anteil, fuelleTage, sortiereHinweise } from "./regeln";

@Injectable()
export class StatistikService {
  constructor(
    private readonly intranet: IntranetService,
    private readonly db: DatenbankService,
    private readonly haeuser: HaeuserService,
    private readonly interessenten: InteressentenService,
  ) {}

  /** Startseite: Kennzahlen und alles, was Aufmerksamkeit braucht. */
  async uebersicht() {
    const [haeuser, auswertung, leadHinweise] = await Promise.all([
      this.haeuser.liste(),
      this.interessenten.auswertung(),
      this.interessenten.hinweise(),
    ]);
    const aktiveHaeuser = haeuser.filter((haus) => haus.isActive);
    const konten = aktiveHaeuser.reduce((summe, haus) => summe + haus.aktiveKonten, 0);
    const mitLizenz = aktiveHaeuser.filter((haus) => haus.licensedSeats !== null);
    const lizenzen = mitLizenz.reduce((summe, haus) => summe + (haus.licensedSeats ?? 0), 0);
    const belegt = mitLizenz.reduce((summe, haus) => summe + haus.aktiveKonten, 0);
    const mfa = aktiveHaeuser.reduce((summe, haus) => summe + haus.mitMfa, 0);
    const nutzer30 = aktiveHaeuser.reduce((summe, haus) => summe + haus.aktiv30, 0);

    const aktionen = await this.intranet.eine<{ diese: number; vorige: number }>(
      `SELECT count(*) FILTER (WHERE a."createdAt" > now() - interval '7 days')::int AS diese,
              count(*) FILTER (WHERE a."createdAt" <= now() - interval '7 days' AND a."createdAt" > now() - interval '14 days')::int AS vorige
         FROM "AuditLog" a JOIN "Tenant" t ON t.id = a."tenantId" WHERE ${NUR_KUNDEN} AND a."createdAt" > now() - interval '14 days'`,
    );

    return {
      haeuser: {
        gesamt: haeuser.length,
        aktiv: aktiveHaeuser.length,
        gesperrt: haeuser.length - aktiveHaeuser.length,
        neu30: haeuser.filter((haus) => Date.now() - haus.createdAt.getTime() < 30 * 86_400_000).length,
      },
      konten: {
        aktiv: konten,
        aktiv30: nutzer30,
        anteilAktiv30: anteil(nutzer30, konten),
        mitMfa: mfa,
        mfaAnteil: anteil(mfa, konten),
      },
      lizenzen: {
        vergeben: lizenzen,
        belegt,
        auslastung: anteil(belegt, lizenzen),
        haeuserOhneLimit: aktiveHaeuser.length - mitLizenz.length,
      },
      standorte: aktiveHaeuser.reduce((summe, haus) => summe + haus.standorte, 0),
      aktionen: { dieseWoche: aktionen?.diese ?? 0, vorWoche: aktionen?.vorige ?? 0 },
      interessenten: auswertung,
      hinweise: sortiereHinweise([...haeuser.flatMap((haus) => haus.hinweise), ...leadHinweise]),
      aktivste: [...aktiveHaeuser]
        .sort((a, b) => b.aktionen30 - a.aktionen30)
        .slice(0, 5)
        .map((haus) => ({ id: haus.id, name: haus.name, aktionen30: haus.aktionen30 })),
    };
  }

  /** Auswertungen über alle Kundenhäuser. Nur Zählwerte, nie Inhalte. */
  async plattform() {
    const kunden = `FROM "Tenant" t WHERE ${NUR_KUNDEN}`;
    const [tage, arten, monate, anmeldungen, status, tickets, bestellungen, groesse, mfaPflicht, anbieter, nutzung] =
      await Promise.all([
        this.intranet.abfrage<{ tag: string; n: number }>(
          `SELECT to_char(a."createdAt"::date, 'YYYY-MM-DD') AS tag, count(*)::int AS n FROM "AuditLog" a JOIN "Tenant" t ON t.id = a."tenantId"
          WHERE ${NUR_KUNDEN} AND a."createdAt" > now() - interval '90 days' GROUP BY 1`,
        ),
        this.intranet.abfrage<{ art: string; n: number }>(
          `SELECT split_part(a.action, '.', 1) AS art, count(*)::int AS n FROM "AuditLog" a JOIN "Tenant" t ON t.id = a."tenantId"
          WHERE ${NUR_KUNDEN} AND a."createdAt" > now() - interval '30 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
        ),
        this.intranet.abfrage<{ monat: string; n: number }>(
          `SELECT to_char(m, 'YYYY-MM') AS monat, (SELECT count(*) FROM "User" u JOIN "Tenant" t ON t.id = u."tenantId"
            WHERE ${NUR_KUNDEN} AND date_trunc('month', u."createdAt") = m)::int AS n
           FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m ORDER BY 1`,
        ),
        this.intranet.abfrage<{ klasse: string; n: number }>(
          `SELECT CASE WHEN u."lastLoginAt" IS NULL THEN 'nie' WHEN u."lastLoginAt" > now() - interval '1 day' THEN 'heute'
                     WHEN u."lastLoginAt" > now() - interval '7 days' THEN 'woche' WHEN u."lastLoginAt" > now() - interval '30 days' THEN 'monat'
                     ELSE 'aelter' END AS klasse, count(*)::int AS n
           FROM "User" u JOIN "Tenant" t ON t.id = u."tenantId" WHERE ${NUR_KUNDEN} AND u.status = 'active' GROUP BY 1`,
        ),
        this.intranet.abfrage<{ status: string; n: number }>(
          `SELECT o.status::text AS status, count(*)::int AS n FROM "Order" o JOIN "Tenant" t ON t.id = o."tenantId" WHERE ${NUR_KUNDEN} GROUP BY 1`,
        ),
        this.intranet.abfrage<{ status: string; n: number; stunden: number | null }>(
          `SELECT k.status::text AS status, count(*)::int AS n,
                round((avg(extract(epoch FROM (k."closedAt" - k."createdAt")) / 3600) FILTER (WHERE k."closedAt" >= k."createdAt"))::numeric, 1)::float AS stunden
           FROM "Ticket" k JOIN "Tenant" t ON t.id = k."tenantId" WHERE ${NUR_KUNDEN} GROUP BY 1`,
        ),
        this.intranet.eine<{ tage: number | null }>(
          `SELECT round(avg(extract(epoch FROM (o."completedAt" - o."createdAt")) / 86400)::numeric, 1)::float AS tage
           FROM "Order" o JOIN "Tenant" t ON t.id = o."tenantId" WHERE ${NUR_KUNDEN} AND o."completedAt" >= o."createdAt"`,
        ),
        this.intranet.abfrage<{ klasse: string; n: number }>(
          `SELECT CASE WHEN c <= 10 THEN '1-10' WHEN c <= 25 THEN '11-25' WHEN c <= 50 THEN '26-50' WHEN c <= 100 THEN '51-100' ELSE 'über 100' END AS klasse, count(*)::int AS n
           FROM (SELECT (SELECT count(*) FROM "User" u WHERE u."tenantId" = t.id AND u.status = 'active') AS c ${kunden}) x GROUP BY 1`,
        ),
        this.intranet.eine<{ an: number; gesamt: number }>(
          `SELECT count(*) FILTER (WHERE t."mfaPflicht")::int AS an, count(*)::int AS gesamt ${kunden}`,
        ),
        this.intranet.abfrage<{ kind: string; n: number }>(
          `SELECT p.kind::text AS kind, count(*)::int AS n FROM "TenantAuthProvider" p JOIN "Tenant" t ON t.id = p."tenantId" WHERE ${NUR_KUNDEN} AND p."isActive" GROUP BY 1`,
        ),
        this.nutzung(),
      ]);

    const haeuser = await this.haeuser.liste();
    const verbreitung = MODULE_DEFINITIONS.map((modul) => {
      const an = haeuser.filter((haus) => haus.aktiveModule.includes(modul.key)).length;
      return {
        key: modul.key,
        label: modul.label,
        stage: modul.stage as string,
        haeuser: an,
        anteil: anteil(an, haeuser.length),
      };
    }).sort((a, b) => b.haeuser - a.haeuser || a.label.localeCompare(b.label, "de"));

    const ticketGesamt = tickets.reduce((summe, zeile) => summe + zeile.n, 0);
    const geloest = tickets.find((zeile) => zeile.status === "geloest");
    return {
      aktivitaet: fuelleTage(tage, 90),
      aktionsarten: arten,
      neueKonten: monate.map((zeile) => ({ monat: zeile.monat, n: zeile.n })),
      anmeldungen: Object.fromEntries(
        ["heute", "woche", "monat", "aelter", "nie"].map((k) => [k, anmeldungen.find((a) => a.klasse === k)?.n ?? 0]),
      ),
      bestellungen: { nachStatus: status, durchlaufTage: bestellungen?.tage ?? null },
      tickets: {
        nachStatus: tickets.map(({ status, n }) => ({ status, n })),
        gesamt: ticketGesamt,
        loesungsquote: anteil(geloest?.n ?? 0, ticketGesamt),
        loesungsStunden: geloest?.stunden ?? null,
      },
      hausgroessen: ["1-10", "11-25", "26-50", "51-100", "über 100"].map((klasse) => ({
        klasse,
        n: groesse.find((g) => g.klasse === klasse)?.n ?? 0,
      })),
      sicherheit: { mfaPflichtHaeuser: mfaPflicht?.an ?? 0, haeuser: mfaPflicht?.gesamt ?? 0, anbieter },
      modulVerbreitung: verbreitung,
      nutzung,
    };
  }

  /** Datensätze je Fachbereich über alle Häuser, gesamt und letzte 30 Tage. */
  private async nutzung() {
    const teile = NUTZUNG.map(
      (
        eintrag,
        i,
      ) => `SELECT $${i + 1}::text AS key, count(*)::int AS gesamt, count(*) FILTER (WHERE x."createdAt" > now() - interval '30 days')::int AS monat
        FROM "${eintrag.tabelle}" x JOIN "Tenant" t ON t.id = x."tenantId" WHERE ${NUR_KUNDEN}`,
    );
    const zeilen = await this.intranet.abfrage<{ key: string; gesamt: number; monat: number }>(
      teile.join(" UNION ALL "),
      NUTZUNG.map((e) => e.key),
    );
    return NUTZUNG.map((eintrag) => ({
      ...zeilen.find((zeile) => zeile.key === eintrag.key)!,
      label: eintrag.label,
    })).sort((a, b) => b.gesamt - a.gesamt);
  }

  /* ------------------------------------------------ Verlauf (Schnappschüsse) */

  /** Hält den heutigen Stand fest; mehrfaches Aufrufen am selben Tag überschreibt. */
  async schnappschuss(): Promise<{ tag: string; haeuser: number }> {
    const haeuser = await this.haeuser.liste();
    const aktiv = haeuser.filter((haus) => haus.isActive);
    const tag = new Date(new Date().toISOString().slice(0, 10));
    const plattform = {
      haeuser: aktiv.length,
      gesperrt: haeuser.length - aktiv.length,
      konten: aktiv.reduce((s, h) => s + h.aktiveKonten, 0),
      lizenzen: aktiv.reduce((s, h) => s + (h.licensedSeats ?? 0), 0),
      lizenzBelegt: aktiv.filter((h) => h.licensedSeats !== null).reduce((s, h) => s + h.aktiveKonten, 0),
      standorte: aktiv.reduce((s, h) => s + h.standorte, 0),
      aktionen7: aktiv.reduce((s, h) => s + h.aktionen7, 0),
      aktiv30: aktiv.reduce((s, h) => s + h.aktiv30, 0),
    };
    const speichern = (bereich: string, werte: object) =>
      this.db.schnappschuss.upsert({
        where: { tag_bereich: { tag, bereich } },
        create: { tag, bereich, werte },
        update: { werte },
      });
    await speichern("plattform", plattform);
    for (const haus of haeuser) {
      await speichern(haus.slug, {
        konten: haus.aktiveKonten,
        lizenzen: haus.licensedSeats,
        standorte: haus.standorte,
        aktionen7: haus.aktionen7,
        aktiv30: haus.aktiv30,
      });
    }
    return { tag: tag.toISOString().slice(0, 10), haeuser: haeuser.length };
  }

  async verlauf(bereich = "plattform", tage = 180) {
    const seit = new Date(Date.now() - tage * 86_400_000);
    const zeilen = await this.db.schnappschuss.findMany({
      where: { bereich, tag: { gte: seit } },
      orderBy: { tag: "asc" },
    });
    return zeilen.map((zeile) => ({
      tag: zeile.tag.toISOString().slice(0, 10),
      ...(zeile.werte as Record<string, number>),
    }));
  }
}
