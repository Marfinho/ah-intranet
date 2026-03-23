import { Injectable } from "@nestjs/common";
import { auditLogs } from "@ah-intranet/shared";

interface AuditPayload {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
}

@Injectable()
export class AuditService {
  private readonly items = [...auditLogs];

  findAll() {
    return this.items;
  }

  log(payload: AuditPayload) {
    this.items.unshift({
      id: `audit-${this.items.length + 1}`,
      createdAt: new Date().toISOString(),
      actor: payload.actor,
      action: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId,
      detail: payload.detail,
    });
  }
}
