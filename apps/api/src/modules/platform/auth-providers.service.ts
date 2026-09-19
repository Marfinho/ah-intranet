import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthProviderKind, AuthProviderSummary } from "@ah-intranet/shared";
import { getAuthProvider } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { istVerschluesselungMoeglich, verschluessele } from "../../core/geheimnis";
import { toIso } from "../../core/mappers";
import type { RequestUser } from "../../core/request-user";

export interface AuthProviderInput {
  kind: AuthProviderKind;
  label: string;
  directory: string;
  clientId: string;
  /** Leer lassen heißt: den hinterlegten Schlüssel behalten. */
  clientSecret?: string;
}

/**
 * Zusätzliche Anmeldearten je Haus.
 *
 * Das Passwort bleibt der Grundweg und steht nicht in dieser Tabelle - jedes
 * Haus startet ohne Vorbedingung, und der Zugang vom Telefon in der Halle hängt
 * nicht an der IT-Einrichtung des Kunden.
 */
@Injectable()
export class AuthProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<AuthProviderSummary[]> {
    const rows = await this.prisma.tenantAuthProvider.findMany({ orderBy: { kind: "asc" } });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind as AuthProviderKind,
      label: row.label,
      directory: row.directory,
      clientId: row.clientId,
      // Nur die Tatsache, nie der Wert: ein Geheimnis, das die API herausgibt,
      // ist keines mehr.
      hasSecret: Boolean(row.clientSecret),
      isActive: row.isActive,
      updatedAt: toIso(row.updatedAt)!,
    }));
  }

  async upsert(actor: RequestUser, input: AuthProviderInput): Promise<AuthProviderSummary[]> {
    if (!getAuthProvider(input.kind)) {
      throw new BadRequestException(`Unbekannte Anmeldeart: ${input.kind}`);
    }
    if (input.clientSecret && !istVerschluesselungMoeglich()) {
      throw new BadRequestException(
        "Ohne gesetzten SECRET_KEY lässt sich der Clientschlüssel nicht verschlüsselt ablegen. " +
          "Im Klartext wird er nicht gespeichert.",
      );
    }

    const gemeinsam = {
      label: input.label.trim(),
      directory: input.directory.trim(),
      clientId: input.clientId.trim(),
      ...(input.clientSecret ? { clientSecret: verschluessele(input.clientSecret) } : {}),
    };

    // Kein `upsert`: dessen Bedingung verlangt den zusammengesetzten Schlüssel
    // mit dem Mandanten, und den führt der Fachcode bewusst nicht mit.
    const vorhanden = await this.prisma.tenantAuthProvider.findFirst({ where: { kind: input.kind } });
    if (vorhanden) {
      await this.prisma.tenantAuthProvider.update({ where: { id: vorhanden.id }, data: gemeinsam });
    } else {
      await this.prisma.tenantAuthProvider.create({ data: { kind: input.kind, ...gemeinsam } });
    }

    await this.audit.log({
      actor,
      action: "auth_provider.saved",
      entityType: "auth_provider",
      entityId: input.kind,
      detail: `Anmeldeart "${getAuthProvider(input.kind)!.name}" hinterlegt`,
      metadata: { schluesselGesetzt: Boolean(input.clientSecret) },
    });

    return this.list();
  }

  /**
   * Schaltet eine Anmeldeart frei.
   *
   * Solange der Austausch mit dem Anbieter nicht gebaut ist, wird das abgelehnt
   * statt einen Knopf anzubieten, der ins Leere führt. Die Zugangsdaten dürfen
   * trotzdem schon hinterlegt werden - dann ist beim Bau nichts mehr zu tun.
   */
  async setActive(actor: RequestUser, kind: AuthProviderKind, isActive: boolean): Promise<AuthProviderSummary[]> {
    const definition = getAuthProvider(kind);
    if (!definition) {
      throw new BadRequestException(`Unbekannte Anmeldeart: ${kind}`);
    }
    const row = await this.prisma.tenantAuthProvider.findFirst({ where: { kind } });
    if (!row) {
      throw new NotFoundException("Für diese Anmeldeart ist nichts hinterlegt.");
    }
    if (isActive && !definition.inBetrieb) {
      throw new BadRequestException(
        `${definition.name} ist vorbereitet, aber in dieser Fassung nicht in Betrieb. ` +
          "Die Zugangsdaten bleiben gespeichert; freischalten lässt sich die Anmeldeart, sobald der Austausch mit " +
          "dem Anbieter gebaut ist.",
      );
    }
    if (isActive && !row.clientSecret) {
      throw new BadRequestException("Ohne hinterlegten Clientschlüssel lässt sich die Anmeldeart nicht freischalten.");
    }

    await this.prisma.tenantAuthProvider.update({ where: { id: row.id }, data: { isActive } });

    await this.audit.log({
      actor,
      action: isActive ? "auth_provider.enabled" : "auth_provider.disabled",
      entityType: "auth_provider",
      entityId: kind,
      detail: `Anmeldeart "${definition.name}" ${isActive ? "freigeschaltet" : "abgeschaltet"}`,
    });

    return this.list();
  }

  async remove(actor: RequestUser, kind: AuthProviderKind): Promise<AuthProviderSummary[]> {
    const row = await this.prisma.tenantAuthProvider.findFirst({ where: { kind } });
    if (!row) {
      throw new NotFoundException("Für diese Anmeldeart ist nichts hinterlegt.");
    }
    await this.prisma.tenantAuthProvider.delete({ where: { id: row.id } });

    await this.audit.log({
      actor,
      action: "auth_provider.removed",
      entityType: "auth_provider",
      entityId: kind,
      detail: `Anmeldeart "${getAuthProvider(kind)?.name ?? kind}" entfernt`,
    });

    return this.list();
  }
}
