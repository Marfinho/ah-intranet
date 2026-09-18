import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "./core/prisma.service";

export interface HealthReport {
  ok: boolean;
  service: string;
  /** Prozesslaufzeit in Sekunden - verrät Neustartschleifen. */
  uptimeSeconds: number;
  checks: {
    database: { ok: boolean; latencyMs?: number; message?: string };
    secrets: { ok: boolean; message?: string };
  };
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    return {
      ok: database.ok && secrets.ok,
      service: "ah-intranet-api",
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database, secrets },
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

  /** Fehlende Schlüssel fallen sonst erst beim ersten Anmeldeversuch auf. */
  private checkSecrets(): HealthReport["checks"]["secrets"] {
    const fehlend = ["JWT_SECRET", "DATABASE_URL"].filter((name) => !process.env[name]);

    return fehlend.length === 0 ? { ok: true } : { ok: false, message: `Nicht gesetzt: ${fehlend.join(", ")}` };
  }
}
