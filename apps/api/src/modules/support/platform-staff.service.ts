import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PLATFORM_PERMISSION_KEYS } from "@ah-intranet/shared";
import type { PlatformStaffSummary } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { runUnscoped } from "../../core/tenant-context";
import { displayName } from "../../core/mappers";
import type { RequestUser } from "../../core/request-user";

/**
 * Mitarbeitende der Plattformverwaltung, gleich in welchem Haus ihr Konto
 * sitzt - ein Konto der Plattform ist ein gewöhnliches Benutzerkonto irgendeines
 * Hauses, das zusätzlich Plattformrechte trägt. Deshalb außerhalb des
 * Mandantenfilters (`runUnscoped`): die Betreibersitzung ist selbst nur in
 * ihrem eigenen Haus angemeldet, muss hier aber alle Häuser durchsuchen können.
 */
@Injectable()
export class PlatformStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Alle Konten mit Plattformbezug - Betreiber und einzeln freigeschaltete Mitarbeitende. */
  async list(): Promise<PlatformStaffSummary[]> {
    return runUnscoped(async () => {
      const users = await this.prisma.user.findMany({
        where: { OR: [{ isPlatformAdmin: true }, { platformPermissions: { isEmpty: false } }] },
        include: { tenant: { select: { slug: true, name: true } } },
        orderBy: [{ isPlatformAdmin: "desc" }, { lastName: "asc" }],
      });
      return users.map((user) => this.toSummary(user));
    });
  }

  /** Sucht ein Konto zum Freischalten - über alle Häuser, ohne Rücksicht auf das eigene. */
  async search(query: string): Promise<PlatformStaffSummary[]> {
    const term = query.trim();
    if (term.length < 2) {
      return [];
    }
    return runUnscoped(async () => {
      const users = await this.prisma.user.findMany({
        where: {
          status: "active",
          OR: [
            { username: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
            { firstName: { contains: term, mode: "insensitive" } },
            { lastName: { contains: term, mode: "insensitive" } },
          ],
        },
        include: { tenant: { select: { slug: true, name: true } } },
        orderBy: [{ lastName: "asc" }],
        take: 10,
      });
      return users.map((user) => this.toSummary(user));
    });
  }

  /** Setzt die Plattformrechte eines Kontos vollständig neu. */
  async setPermissions(actor: RequestUser, userId: string, permissions: string[]): Promise<PlatformStaffSummary> {
    const unbekannt = permissions.filter((key) => !PLATFORM_PERMISSION_KEYS.includes(key));
    if (unbekannt.length > 0) {
      throw new BadRequestException(`Unbekanntes Plattformrecht: ${unbekannt.join(", ")}`);
    }

    return runUnscoped(async () => {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { tenant: { select: { slug: true, name: true } } },
      });
      if (!user) {
        throw new NotFoundException("Konto nicht gefunden");
      }
      if (user.isPlatformAdmin) {
        throw new BadRequestException(
          "Die Plattformverwaltung trägt bereits alle Rechte - eine Einzelfreischaltung ist überflüssig.",
        );
      }

      const einzigartig = [...new Set(permissions)];
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { platformPermissions: einzigartig },
        include: { tenant: { select: { slug: true, name: true } } },
      });

      await this.audit.log({
        actor,
        tenantId: user.tenantId,
        action: "platform_staff.permissions",
        entityType: "user",
        entityId: userId,
        detail:
          einzigartig.length > 0
            ? `Plattformrechte von ${displayName(user)} gesetzt: ${einzigartig.join(", ")}`
            : `Plattformrechte von ${displayName(user)} entzogen`,
      });

      return this.toSummary(updated);
    });
  }

  private toSummary(user: {
    id: string;
    username: string;
    email: string | null;
    firstName: string;
    lastName: string;
    isPlatformAdmin: boolean;
    platformPermissions: string[];
    tenant: { slug: string; name: string };
  }): PlatformStaffSummary {
    return {
      id: user.id,
      username: user.username,
      displayName: displayName(user),
      email: user.email,
      tenant: user.tenant,
      isPlatformAdmin: user.isPlatformAdmin,
      platformPermissions: user.platformPermissions,
    };
  }
}
