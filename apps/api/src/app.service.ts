import { Injectable, Logger } from "@nestjs/common";
import { AuditService } from "./core/audit.service";
import { PrismaService } from "./core/prisma.service";

export interface HealthReport {
  ok: boolean;
  service: string;
  /** Prozesslaufzeit in Sekunden - verrät Neustartschleifen. */
  uptimeSeconds: number;
  checks: {
    database: { ok: boolean; latencyMs?: number; message?: string };
    secrets: { ok: boolean; message?: string };
    /**
     * Fehlgeschlagene Audit-Einträge der letzten Stunde. Bewusst **ohne**
     * Einfluss auf `ok`: ein Protokollfehler ist meldepflichtig, aber die
     * Instanz deswegen aus dem Verkehr zu ziehen hilft niemandem - es folgte
     * eine Neustartschleife, die das Protokoll auch nicht schreibt.
     */
    audit: { ok: boolean; ausfaelleLetzteStunde: number; message?: string };
  };
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Prüft, ob der Dienst tatsächlich arbeitsfähig ist.
   *
   * Ein Healthcheck, der nur `{ ok: true }` zurückgibt, meldet den Container
   * auch dann als gesund, wenn die Datenbank weg ist - genau dann, wenn eine
   * Umschaltung nötig wäre. Deshalb wird hier wirklich abgefragt.
   */
  async getHealth(): Promise<HealthReport> {
    const database = await this.checkDatabase();
    const secrets = this.checkSecrets();
    const audit = this.checkAudit();

    return {
      ok: database.ok && secrets.ok,
      service: "ah-intranet-api",
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database, secrets, audit },
    };
  }

  private async checkDatabase(): Promise<HealthReport["checks"]["database"]> {
    const started = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      this.logger.error("Healthcheck: Datenbank nicht erreichbar", error as Error);
      return { ok: false, message: "Datenbank nicht erreichbar" };
    }
  }

  /**
   * Lücken im Audit-Log sichtbar machen.
   *
   * `AuditService.log` schluckt Fehler bewusst, damit die Fachaktion nicht
   * scheitert. Ohne diese Anzeige wüsste niemand, dass das Protokoll Lücken
   * hat - und ein Protokoll mit unbemerkten Lücken ist kein Nachweis.
   */
  private checkAudit(): HealthReport["checks"]["audit"] {
    const ausfaelle = this.audit.ausfaelleImFenster();
    return ausfaelle === 0
      ? { ok: true, ausfaelleLetzteStunde: 0 }
      : {
          ok: false,
          ausfaelleLetzteStunde: ausfaelle,
          message: `${ausfaelle} Audit-Eintrag/Einträge der letzten Stunde konnten nicht geschrieben werden.`,
        };
  }

  /** Fehlende Schlüssel fallen sonst erst beim ersten Anmeldeversuch auf. */
  private checkSecrets(): HealthReport["checks"]["secrets"] {
    const fehlend = ["JWT_SECRET", "DATABASE_URL"].filter((name) => !process.env[name]);

    return fehlend.length === 0 ? { ok: true } : { ok: false, message: `Nicht gesetzt: ${fehlend.join(", ")}` };
  }
}
