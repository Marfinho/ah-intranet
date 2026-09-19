import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { currentTenant, hasNoContext, isUnscoped } from "./tenant-context";
import { applyTenantScope, isGlobalModel } from "./tenant-isolation";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    this.installTenantIsolation();
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Trennt die Mandanten auf Ebene des Datenzugriffs.
   *
   * Das ist die eigentliche Sicherheitsgrenze: Fachcode muss `tenantId` nirgends
   * mitführen, und ein vergessener Filter in einem Service kann keine fremden
   * Daten preisgeben. Umgekehrt schlägt jede Abfrage ohne gesetzten
   * Mandantenkontext fehl, statt stillschweigend über alle Häuser zu laufen.
   *
   * Grenze der Methode: `$queryRaw` und `$executeRaw` laufen ohne Modell durch
   * die Middleware und sind damit ungefiltert. Rohabfragen müssen den Mandanten
   * deshalb selbst in die Bedingung aufnehmen - in dieser Anwendung gibt es
   * bisher nur das `SELECT 1` des Healthchecks.
   *
   * Umgesetzt als Middleware statt als Client-Erweiterung, weil die Erweiterung
   * einen neuen Client zurückgibt und damit jeden Aufruf im Fachcode ändern
   * würde. Die Middleware ist in Prisma 5 als veraltet markiert, aber
   * funktionsfähig; der Wechsel auf `$extends` ist beim Sprung auf Prisma 6 fällig.
   */
  private installTenantIsolation(): void {
    this.$use(async (params, next) => {
      if (isGlobalModel(params.model) || isUnscoped()) {
        return next(params);
      }

      const tenant = currentTenant();
      if (!tenant) {
        // Lieber ein harter Fehler als eine Abfrage über alle Mandanten.
        const grund = hasNoContext() ? "kein Mandantenkontext gesetzt" : "Mandant unbekannt";
        this.logger.error(`Zugriff auf ${params.model}.${params.action} abgelehnt: ${grund}`);
        throw new Error(
          `Zugriff auf ${params.model} ohne Mandantenkontext. Aufrufe außerhalb einer Anfrage müssen runWithTenant oder runUnscoped verwenden.`,
        );
      }

      params.args = applyTenantScope(params, tenant.tenantId);
      return next(params);
    });
  }
}
