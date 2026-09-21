import { Injectable, NotFoundException } from "@nestjs/common";
import type { Priority, TicketStatus } from "@prisma/client";
import type { PlatformSupportMessage, PlatformSupportTicketSummary } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { runUnscoped } from "../../core/tenant-context";
import { displayName } from "../../core/mappers";
import type { RequestUser } from "../../core/request-user";

const ticketInclude = {
  tenant: { select: { slug: true, name: true } },
  requester: { select: { firstName: true, lastName: true } },
  assignee: { select: { firstName: true, lastName: true } },
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { firstName: true, lastName: true } } },
  },
  _count: { select: { messages: true } },
} as const;

type TicketWithRelations = {
  id: string;
  number: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  tenant: { slug: string; name: string };
  requester: { firstName: string; lastName: string };
  assignee: { firstName: string; lastName: string } | null;
  messages: {
    id: string;
    body: string;
    isStaffReply: boolean;
    isInternal: boolean;
    createdAt: Date;
    author: { firstName: string; lastName: string };
  }[];
  _count: { messages: number };
};

/**
 * Support-Posteingang der Plattformverwaltung: alle Häuser in einer Sicht.
 *
 * Läuft bewusst außerhalb des Mandantenfilters (`runUnscoped`) - eine Sitzung
 * der Plattformverwaltung ist selbst im eigenen Haus angemeldet, die Anfragen
 * gehören aber jedem Haus. Schreibende Zugriffe stempeln den Mandanten des
 * jeweiligen Tickets deshalb ausdrücklich mit, statt sich auf die sonst
 * automatische Stempelung zu verlassen - die greift außerhalb des Filters nicht.
 */
@Injectable()
export class PlatformSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(filter: { status?: string; search?: string } = {}): Promise<PlatformSupportTicketSummary[]> {
    return runUnscoped(async () => {
      const tickets = await this.prisma.supportTicket.findMany({
        where: {
          ...(filter.status && filter.status !== "all" ? { status: filter.status as TicketStatus } : {}),
          ...(filter.search
            ? {
                OR: [
                  { number: { contains: filter.search, mode: "insensitive" as const } },
                  { subject: { contains: filter.search, mode: "insensitive" as const } },
                  { description: { contains: filter.search, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        include: ticketInclude,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 200,
      });
      return tickets.map((ticket) => this.toSummary(ticket, false));
    });
  }

  async detail(id: string): Promise<PlatformSupportTicketSummary> {
    return runUnscoped(async () => {
      const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, include: ticketInclude });
      if (!ticket) {
        throw new NotFoundException("Support-Anfrage nicht gefunden");
      }
      return this.toSummary(ticket, true);
    });
  }

  async addMessage(
    user: RequestUser,
    id: string,
    input: { body: string; isInternal: boolean },
  ): Promise<PlatformSupportTicketSummary> {
    return runUnscoped(async () => {
      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id },
        select: { id: true, number: true, tenantId: true },
      });
      if (!ticket) {
        throw new NotFoundException("Support-Anfrage nicht gefunden");
      }

      await this.prisma.supportTicketMessage.create({
        data: {
          tenantId: ticket.tenantId,
          ticketId: id,
          authorId: user.id,
          body: input.body,
          isStaffReply: true,
          isInternal: input.isInternal,
        },
      });

      await this.audit.log({
        actor: user,
        tenantId: ticket.tenantId,
        action: "support_ticket.staff_message",
        entityType: "support_ticket",
        entityId: id,
        detail: `${input.isInternal ? "Interne Notiz" : "Antwort"} zu ${ticket.number}`,
      });

      return this.detail(id);
    });
  }

  async update(
    user: RequestUser,
    id: string,
    input: { status?: TicketStatus; priority?: Priority; assigneeId?: string | null },
  ): Promise<PlatformSupportTicketSummary> {
    return runUnscoped(async () => {
      const existing = await this.prisma.supportTicket.findUnique({
        where: { id },
        select: { id: true, number: true, tenantId: true },
      });
      if (!existing) {
        throw new NotFoundException("Support-Anfrage nicht gefunden");
      }

      // Die zuweisbare Person ist ein Konto der Plattformverwaltung, gleich in
      // welchem Haus es sitzt - anders als bei internen Tickets keine
      // Beschränkung auf den Mandanten der Anfrage.
      if (input.assigneeId) {
        const zustaendig = await this.prisma.user.findFirst({
          where: { id: input.assigneeId, status: "active" },
          select: { id: true, isPlatformAdmin: true, platformPermissions: true },
        });
        if (!zustaendig || !(zustaendig.isPlatformAdmin || zustaendig.platformPermissions.includes("support.tickets.manage"))) {
          throw new NotFoundException("Die zuständige Person wurde nicht gefunden.");
        }
      }

      const updated = await this.prisma.supportTicket.update({
        where: { id },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId || null } : {}),
          ...(input.status === "geloest" ? { closedAt: new Date() } : {}),
        },
        include: ticketInclude,
      });

      await this.audit.log({
        actor: user,
        tenantId: existing.tenantId,
        action: "support_ticket.update",
        entityType: "support_ticket",
        entityId: id,
        detail: `${existing.number} aktualisiert (${updated.status})`,
      });

      return this.toSummary(updated, true);
    });
  }

  private toSummary(ticket: TicketWithRelations, withMessages: boolean): PlatformSupportTicketSummary {
    const messages: PlatformSupportMessage[] = ticket.messages.map((message) => ({
      id: message.id,
      body: message.body,
      isStaffReply: message.isStaffReply,
      isInternal: message.isInternal,
      author: displayName(message.author),
      createdAt: message.createdAt.toISOString(),
    }));

    return {
      id: ticket.id,
      number: ticket.number,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      tenant: ticket.tenant,
      requester: displayName(ticket.requester),
      assignee: ticket.assignee ? displayName(ticket.assignee) : null,
      assigneeId: ticket.assigneeId,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      closedAt: ticket.closedAt?.toISOString() ?? null,
      messageCount: ticket._count.messages,
      ...(withMessages ? { messages } : {}),
    };
  }
}
