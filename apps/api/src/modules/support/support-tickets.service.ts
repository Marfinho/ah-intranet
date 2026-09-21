import { Injectable, NotFoundException } from "@nestjs/common";
import type { Priority } from "@prisma/client";
import type { SupportTicketMessage, SupportTicketSummary } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { buildNumber, displayName } from "../../core/mappers";
import type { RequestUser } from "../../core/request-user";

const ticketInclude = {
  requester: { select: { firstName: true, lastName: true } },
  messages: {
    // Interne Notizen der Plattformverwaltung sind nie für das Haus bestimmt.
    where: { isInternal: false },
    orderBy: { createdAt: "asc" as const },
  },
  _count: { select: { messages: { where: { isInternal: false } } } },
} as const;

type TicketWithRelations = {
  id: string;
  number: string;
  subject: string;
  description: string;
  status: SupportTicketSummary["status"];
  priority: SupportTicketSummary["priority"];
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  requester: { firstName: string; lastName: string };
  messages: { id: string; body: string; isStaffReply: boolean; createdAt: Date }[];
  _count: { messages: number };
};

/**
 * Support-Anfragen des eigenen Hauses an den Betreiber.
 *
 * Bewusst ganz normal mandantengefiltert: ein Haus sieht ausschließlich seine
 * eigenen Anfragen, genau wie bei jedem anderen Fachdatensatz. Die Sicht der
 * Plattformverwaltung auf alle Häuser liegt in `PlatformSupportService`.
 */
@Injectable()
export class SupportTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<SupportTicketSummary[]> {
    const tickets = await this.prisma.supportTicket.findMany({
      include: ticketInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return tickets.map((ticket) => this.toSummary(ticket, false));
  }

  async detail(id: string): Promise<SupportTicketSummary> {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, include: ticketInclude });
    if (!ticket) {
      throw new NotFoundException("Support-Anfrage nicht gefunden");
    }
    return this.toSummary(ticket, true);
  }

  async create(
    user: RequestUser,
    input: { subject: string; description: string; priority: Priority },
  ): Promise<SupportTicketSummary> {
    const number = buildNumber("SUP", (await this.prisma.supportTicket.count()) + 1);

    const ticket = await this.prisma.supportTicket.create({
      data: {
        number,
        subject: input.subject,
        description: input.description,
        priority: input.priority,
        requesterId: user.id,
      },
      include: ticketInclude,
    });

    await this.audit.log({
      actor: user,
      action: "support_ticket.create",
      entityType: "support_ticket",
      entityId: ticket.id,
      detail: `${number}: ${input.subject}`,
    });

    return this.toSummary(ticket, true);
  }

  async addMessage(user: RequestUser, id: string, body: string): Promise<SupportTicketSummary> {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, select: { id: true, number: true } });
    if (!ticket) {
      throw new NotFoundException("Support-Anfrage nicht gefunden");
    }

    await this.prisma.supportTicketMessage.create({
      data: { ticketId: id, authorId: user.id, body, isStaffReply: false },
    });

    await this.audit.log({
      actor: user,
      action: "support_ticket.message",
      entityType: "support_ticket",
      entityId: id,
      detail: `Nachricht zu ${ticket.number}`,
    });

    return this.detail(id);
  }

  private toSummary(ticket: TicketWithRelations, withMessages: boolean): SupportTicketSummary {
    const messages: SupportTicketMessage[] = ticket.messages.map((message) => ({
      id: message.id,
      body: message.body,
      isStaffReply: message.isStaffReply,
      createdAt: message.createdAt.toISOString(),
    }));

    return {
      id: ticket.id,
      number: ticket.number,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      requester: displayName(ticket.requester),
      assigned: ticket.assigneeId !== null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      closedAt: ticket.closedAt?.toISOString() ?? null,
      messageCount: ticket._count.messages,
      ...(withMessages ? { messages } : {}),
    };
  }
}
