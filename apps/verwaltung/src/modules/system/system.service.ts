import { Injectable } from "@nestjs/common";
import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import {
  MODULE_DEFINITIONS,
  PERMISSION_DEFINITIONS,
  PREISLISTE_VERSION,
  RETENTION_RULES,
  ROLE_DEFINITIONS,
  TIERS,
} from "@ah-intranet/shared";
import { DatenbankService } from "../../core/datenbank";
import { IntranetService } from "../../core/intranet.service";

/** Adresse ohne Zugangsdaten - Benutzer und Passwort gehören nie in eine Anzeige. */
function ohneZugang(adresse: string | undefined): string | null {
  if (!adresse) return null;
  try {
    const url = new URL(adresse);
    return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}${url.searchParams.get("schema") ? ` (Schema ${url.searchParams.get("schema")})` : ""}`;
  } catch {
    return "ungültige Adresse";
  }
}

const gesetzt = (name: string) => Boolean(process.env[name]?.trim());

@Injectable()
export class SystemService {
  constructor(
    private readonly intranet: IntranetService,
    private readonly db: DatenbankService,
  ) {}

  async parameter() {
    const [datenbank, tabellen, migrationen, eigeneMigrationen, api, sicherung] = await Promise.all([
      this.datenbank().catch((fehler: Error) => ({ fehler: fehler.message })),
      this.tabellen().catch(() => []),
      this.migrationen(this.intranet).catch(() => null),
      this.eigeneMigrationen().catch(() => null),
      this.intranetApi(),
      this.sicherung(),
    ]);

    const speicher = process.memoryUsage();
    return {
      erzeugtAm: new Date().toISOString(),
      prozess: {
        node: process.version,
        plattform: `${process.platform}/${process.arch}`,
        pid: process.pid,
        laufzeitSekunden: Math.round(process.uptime()),
        umgebung: process.env.NODE_ENV ?? "development",
        speicherMb: { rss: mb(speicher.rss), heap: mb(speicher.heapUsed), heapGesamt: mb(speicher.heapTotal) },
      },
      server: {
        hostname: os.hostname(),
        kerne: os.cpus().length,
        last: os.loadavg().map((wert) => Math.round(wert * 100) / 100),
        arbeitsspeicherMb: { gesamt: mb(os.totalmem()), frei: mb(os.freemem()) },
        laufzeitSekunden: Math.round(os.uptime()),
      },
      konfiguration: [
        { name: "Datenbank der Häuser", wert: ohneZugang(process.env.INTRANET_DATABASE_URL) },
        { name: "Eigene Daten der Verwaltung", wert: ohneZugang(process.env.VERWALTUNG_DATABASE_URL) },
        { name: "Adresse der Kunden-API", wert: process.env.INTRANET_API_URL ?? null },
        { name: "Basisadresse (BASE_DOMAIN)", wert: process.env.BASE_DOMAIN ?? null },
        { name: "Port", wert: process.env.PORT ?? "3002" },
        { name: "Sitzungsschlüssel gesetzt", wert: gesetzt("VERWALTUNG_JWT_SECRET") },
        { name: "SECRET_KEY gesetzt (zweiter Faktor)", wert: gesetzt("SECRET_KEY") },
        { name: "E-Mail-Versand (SMTP_HOST)", wert: gesetzt("SMTP_HOST") },
        { name: "Sicherungsverzeichnis eingebunden", wert: gesetzt("SICHERUNG_VERZEICHNIS") },
      ],
      datenbank,
      tabellen,
      migrationen: { haeuser: migrationen, verwaltung: eigeneMigrationen },
      kundenApi: api,
      sicherung,
      register: {
        module: {
          gesamt: MODULE_DEFINITIONS.length,
          stabil: MODULE_DEFINITIONS.filter((m) => m.stage === "stabil").length,
          erprobung: MODULE_DEFINITIONS.filter((m) => m.stage === "beta").length,
          kern: MODULE_DEFINITIONS.filter((m) => m.core).length,
        },
        rechte: PERMISSION_DEFINITIONS.length,
        grundrollen: ROLE_DEFINITIONS.map((rolle) => rolle.key),
        aufbewahrungsregeln: RETENTION_RULES.length,
        preislisteVersion: PREISLISTE_VERSION,
        tiers: TIERS.map((tier) => tier.key),
      },
    };
  }

  private async datenbank() {
    const [kopf, aktivitaet, verbindungen] = await Promise.all([
      this.intranet.eine<{ version: string; groesse: number; gestartet: Date; datenbank: string }>(
        `SELECT split_part(version(), ' on ', 1) AS version, pg_database_size(current_database())::bigint::float8 AS groesse,
                pg_postmaster_start_time() AS gestartet, current_database() AS datenbank`,
      ),
      this.intranet.eine<{
        commits: number;
        rollbacks: number;
        deadlocks: number;
        gelesen: number;
        treffer: number;
        temp_bytes: number;
      }>(
        `SELECT xact_commit::float8 AS commits, xact_rollback::float8 AS rollbacks, deadlocks::float8 AS deadlocks,
                blks_read::float8 AS gelesen, blks_hit::float8 AS treffer, temp_bytes::float8 AS temp_bytes
           FROM pg_stat_database WHERE datname = current_database()`,
      ),
      this.intranet.eine<{ aktiv: number; gesamt: number; maximal: number }>(
        `SELECT (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active')::int AS aktiv,
                (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::int AS gesamt,
                current_setting('max_connections')::int AS maximal`,
      ),
    ]);
    const gelesen = (aktivitaet?.gelesen ?? 0) + (aktivitaet?.treffer ?? 0);
    return {
      ...kopf,
      groesseMb: mb(kopf?.groesse ?? 0),
      zwischenspeicherTreffer: gelesen > 0 ? Math.round(((aktivitaet?.treffer ?? 0) / gelesen) * 1000) / 10 : null,
      transaktionen: aktivitaet?.commits ?? 0,
      zurueckgerollt: aktivitaet?.rollbacks ?? 0,
      deadlocks: aktivitaet?.deadlocks ?? 0,
      verbindungen,
    };
  }

  private tabellen() {
    return this.intranet.abfrage<{ name: string; zeilen: number; groesseMb: number }>(
      `SELECT c.relname AS name, coalesce(s.n_live_tup, 0)::float8 AS zeilen,
              round(pg_total_relation_size(c.oid) / 1048576.0, 2)::float8 AS "groesseMb"
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE c.relkind = 'r' AND n.nspname = current_schema() ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 12`,
    );
  }

  private async migrationen(quelle: IntranetService) {
    const zeile = await quelle.eine<{ anzahl: number; zuletzt: string | null; wann: Date | null }>(
      `SELECT count(*)::int AS anzahl, (array_agg(migration_name ORDER BY finished_at DESC))[1] AS zuletzt, max(finished_at) AS wann
         FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    );
    return zeile;
  }

  /** Das eigene Schema steht in der Adresse; nur Bezeichner-Zeichen sind zulässig, weil es in SQL eingesetzt wird. */
  private async eigeneMigrationen() {
    const schema =
      new URL(process.env.VERWALTUNG_DATABASE_URL ?? "postgresql://x/y").searchParams.get("schema") ?? "public";
    if (!/^[a-z_][a-z0-9_]*$/i.test(schema)) return null;
    const zeilen = await this.db.$queryRawUnsafe<{ anzahl: number; zuletzt: string | null }[]>(
      `SELECT count(*)::int AS anzahl, (array_agg(migration_name ORDER BY finished_at DESC))[1] AS zuletzt FROM "${schema}"._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    );
    return zeilen[0] ?? null;
  }

  /** Antwortet die Kunden-API? Ihr Healthcheck prüft Datenbank und Schlüssel selbst. */
  private async intranetApi() {
    const basis = process.env.INTRANET_API_URL;
    if (!basis) return { konfiguriert: false as const };
    const start = Date.now();
    try {
      const antwort = await fetch(`${basis.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(4_000) });
      const koerper = (await antwort.json().catch(() => null)) as {
        ok?: boolean;
        uptimeSeconds?: number;
        checks?: unknown;
      } | null;
      return {
        konfiguriert: true as const,
        erreichbar: true,
        ok: antwort.ok && koerper?.ok === true,
        status: antwort.status,
        antwortMs: Date.now() - start,
        laufzeitSekunden: koerper?.uptimeSeconds ?? null,
        pruefungen: koerper?.checks ?? null,
      };
    } catch (fehler) {
      return { konfiguriert: true as const, erreichbar: false, ok: false, fehler: (fehler as Error).message };
    }
  }

  /** Neueste Sicherungsdatei - ohne sie wäre „Sicherung läuft“ nur eine Behauptung. */
  private async sicherung() {
    const ordner = process.env.SICHERUNG_VERZEICHNIS;
    if (!ordner) return { konfiguriert: false as const };
    try {
      const dateien = (await readdir(ordner)).filter((name) => /^ah-intranet-.*\.dump$/.test(name));
      const eintraege = await Promise.all(dateien.map(async (name) => ({ name, ...(await stat(join(ordner, name))) })));
      eintraege.sort((a, b) => b.mtimeMs - a.mtimeMs);
      const neueste = eintraege[0];
      return {
        konfiguriert: true as const,
        anzahl: eintraege.length,
        neueste: neueste
          ? {
              name: neueste.name,
              groesseMb: mb(neueste.size),
              alterStunden: Math.round((Date.now() - neueste.mtimeMs) / 360_000) / 10,
            }
          : null,
      };
    } catch (fehler) {
      return { konfiguriert: true as const, fehler: (fehler as Error).message };
    }
  }
}

function mb(bytes: number): number {
  return Math.round((bytes / 1048576) * 10) / 10;
}
