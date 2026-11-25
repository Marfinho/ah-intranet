import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Lesender (und in engen Grenzen schreibender) Zugang zur Datenbank der
 * Kundenhäuser.
 *
 * Bewusst SQL statt des Prisma-Clients der API: der erzwingt je Anfrage ein
 * Haus, die Verwaltung braucht aber Summen über alle. Die Absicherung liegt
 * eine Ebene tiefer, in der Datenbankrolle (`scripts/verwaltung-rolle.sql`):
 * sie darf nur Spalten ohne Personenbezug lesen. Selbst ein Fehler in einer
 * Abfrage hier kann dadurch keine Namen, Mailadressen oder Inhalte preisgeben.
 */
@Injectable()
export class IntranetService implements OnModuleDestroy {
  private readonly logger = new Logger(IntranetService.name);
  private readonly pool: Pool;

  constructor() {
    const adresse = process.env.INTRANET_DATABASE_URL;
    if (!adresse) {
      throw new Error("INTRANET_DATABASE_URL ist nicht gesetzt.");
    }
    // `?schema=` kennt der Treiber nicht; es wird als Suchpfad der Sitzung gesetzt.
    const url = new URL(adresse);
    const schema = url.searchParams.get("schema") ?? "public";
    url.searchParams.delete("schema");
    this.pool = new Pool({
      connectionString: url.toString(),
      max: 5,
      connectionTimeoutMillis: 5_000,
      // Eine Auswertung darf den Betrieb der Häuser nie ausbremsen.
      statement_timeout: 15_000,
      options: `-c search_path=${schema}`,
    });
    this.pool.on("error", (fehler) => this.logger.error(`Datenbankverbindung: ${fehler.message}`));
  }

  async abfrage<T extends QueryResultRow = Record<string, unknown>>(sql: string, werte: unknown[] = []): Promise<T[]> {
    return (await this.pool.query<T>(sql, werte)).rows;
  }

  async eine<T extends QueryResultRow = Record<string, unknown>>(
    sql: string,
    werte: unknown[] = [],
  ): Promise<T | null> {
    return (await this.abfrage<T>(sql, werte))[0] ?? null;
  }

  async transaktion<T>(arbeit: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const ergebnis = await arbeit(client);
      await client.query("COMMIT");
      return ergebnis;
    } catch (fehler) {
      await client.query("ROLLBACK");
      throw fehler;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
