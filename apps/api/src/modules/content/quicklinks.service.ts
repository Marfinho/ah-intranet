import { Injectable } from "@nestjs/common";
import type { QuickLink } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { audienceFilter } from "../../core/mappers";
import { can, type RequestUser } from "../../core/request-user";

export interface QuickLinkInput {
  label: string;
  url: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
  audienceScopes?: string[];
}

@Injectable()
export class QuickLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: RequestUser, includeInactive = false): Promise<QuickLink[]> {
    const rows = await this.prisma.quickLink.findMany({
      where: includeInactive && can(user, "quicklinks.manage") ? {} : { isActive: true, ...audienceFilter(user) },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      url: row.url,
      description: row.description,
      icon: row.icon,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      audienceScopes: row.audienceScopes,
    }));
  }

  async create(user: RequestUser, input: QuickLinkInput): Promise<QuickLink[]> {
    const created = await this.prisma.quickLink.create({
      data: {
        label: input.label,
        url: input.url,
        description: input.description ?? null,
        icon: input.icon ?? "Link2",
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        audienceScopes: input.audienceScopes?.length ? input.audienceScopes : ["global"],
      },
    });

    await this.audit.log({
      actor: user,
      action: "quicklink.create",
      entityType: "quicklink",
      entityId: created.id,
      detail: `Schnellzugriff "${created.label}" angelegt`,
    });

    return this.list(user, true);
  }

  async update(user: RequestUser, id: string, input: Partial<QuickLinkInput>): Promise<QuickLink[]> {
    const updated = await this.prisma.quickLink.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.audienceScopes !== undefined ? { audienceScopes: input.audienceScopes } : {}),
      },
    });

    await this.audit.log({
      actor: user,
      action: "quicklink.update",
      entityType: "quicklink",
      entityId: id,
      detail: `Schnellzugriff "${updated.label}" bearbeitet`,
    });

    return this.list(user, true);
  }

  async remove(user: RequestUser, id: string): Promise<QuickLink[]> {
    const removed = await this.prisma.quickLink.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: "quicklink.delete",
      entityType: "quicklink",
      entityId: id,
      detail: `Schnellzugriff "${removed.label}" gelöscht`,
    });
    return this.list(user, true);
  }
}
