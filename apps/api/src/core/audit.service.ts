import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { runUnscoped } from "./tenant-context";
import { RequestUser } from "./request-user";

export interface AuditInput {
  actor: RequestUser | { id?: string | null; username: string };
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
  metadata?: Record<string, unknown>;
  /**
   * Nur für Aktionen der Plattformverwaltung an einem fremden Haus: die
   * anmeldende Sitzung steht im eigenen Haus, der Vorgang gehört aber zum Haus
   * der Anfrage. Ohne diese Angabe stempelt der normale Mandantenkontext.
   */
  tenantId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Schreibt einen Audit-Eintrag. Bewusst ohne `await` im Aufrufpfad nutzbar:
   * ein fehlgeschlagenes Protokoll darf die Fachaktion nie scheitern lassen.
   */
  async log(input: AuditInput): Promise<void> {
    try {
      const write = () =>
        this.prisma.auditLog.create({
          data: {
            ...(input.tenantId ? { tenantId: input.tenantId } : {}),
            actorId: input.actor.id ?? null,
            actorUsername: input.actor.username,
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId,
            detail: input.detail,
            metadataJson: (input.metadata ?? undefined) as never,
          },
        });
      // Außerhalb des Mandantenfilters, weil der Vorgang einem anderen Haus
      // gehört als der Sitzung, die ihn ausgelöst hat - der Filter würde sonst
      // entweder den falschen Mandanten stempeln oder hart scheitern.
      await (input.tenantId ? runUnscoped(write) : write());
    } catch (error) {
      this.logger.error(`Audit-Eintrag ${input.action} konnte nicht geschrieben werden`, error as Error);
    }
  }
}
