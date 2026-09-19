import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { RequestUser } from "./request-user";

export interface AuditInput {
  actor: RequestUser | { id?: string | null; username: string };
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
  metadata?: Record<string, unknown>;
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
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actor.id ?? null,
          actorUsername: input.actor.username,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          detail: input.detail,
          metadataJson: (input.metadata ?? undefined) as never,
        },
      });
    } catch (error) {
      this.logger.error(`Audit-Eintrag ${input.action} konnte nicht geschrieben werden`, error as Error);
    }
  }
}
