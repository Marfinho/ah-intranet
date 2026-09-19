import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type IdeaStatus, type Priority, type TicketCategory, type TicketStatus } from "@prisma/client";
import type { Idea, Poll, TicketSummary } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { requireTenantId } from "../../core/tenant-context";
import { AuditService } from "../../core/audit.service";
import { NotificationsService } from "../../core/notifications.service";
import { buildNumber, displayName } from "../../core/mappers";
import { can, type RequestUser } from "../../core/request-user";

const ticketInclude = {
  requester: { select: { id: true, username: true, firstName: true, lastName: true } },
  assignee: { select: { id: true, firstName: true, lastName: true } },
  comments: {
    include: { author: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
  },
  _count: { select: { comments: true } },
} as const;

const ideaInclude = {
  author: { select: { username: true, firstName: true, lastName: true } },
  _count: { select: { votes: true } },
} as const;

const pollInclude = {
  options: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { votes: true } } } },
  _count: { select: { votes: true } },
} as const;

@Injectable()
export class ServiceDeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ---------------------------------------------------------- Tickets */

  async tickets(
    user: RequestUser,
    filter: { scope?: "mine" | "all"; status?: string; category?: string; search?: string } = {},
  ) {
    const scope = filter.scope ?? (can(user, "tickets.manage") ? "all" : "mine");
    // Zwei Bedingungen mit je einem OR gehören in ein AND. Als zwei Schlüssel
    // im selben Objekt gewönne der zweite - und die Suche hätte die Beschränkung
    // auf eigene Vorgänge aufgehoben.
    const where: Prisma.TicketWhereInput = {
      ...(filter.status && filter.status !== "all" ? { status: filter.status as TicketStatus } : {}),
      ...(filter.category && filter.category !== "all" ? { category: filter.category as TicketCategory } : {}),
      AND: [
        ...(scope === "mine" || !can(user, "tickets.manage")
          ? [{ OR: [{ requesterId: user.id }, { assigneeId: user.id }] }]
          : []),
        ...(filter.search
          ? [
              {
                OR: [
                  { number: { contains: filter.search, mode: "insensitive" as const } },
                  { title: { contains: filter.search, mode: "insensitive" as const } },
                  { description: { contains: filter.search, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
      ],
    };

    const tickets = await this.prisma.ticket.findMany({
      where,
      include: ticketInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    return { items: tickets.map((ticket) => this.toTicket(ticket, false)), canManage: can(user, "tickets.manage") };
  }

  async ticketDetail(user: RequestUser, id: string): Promise<TicketSummary> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id }, include: ticketInclude });
    if (!ticket) {
      throw new NotFoundException("Ticket nicht gefunden");
    }
    if (ticket.requesterId !== user.id && ticket.assigneeId !== user.id && !can(user, "tickets.manage")) {
      throw new ForbiddenException("Kein Zugriff auf dieses Ticket.");
    }
    return this.toTicket(ticket, true);
  }

  async createTicket(
    user: RequestUser,
    input: { title: string; description: string; category: TicketCategory; priority: Priority },
  ): Promise<TicketSummary> {
    const number = buildNumber("TIC", (await this.prisma.ticket.count()) + 1);

    const ticket = await this.prisma.ticket.create({
      data: {
        number,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        requesterId: user.id,
      },
      include: ticketInclude,
    });

    await this.audit.log({
      actor: user,
      action: "ticket.create",
      entityType: "ticket",
      entityId: ticket.id,
      detail: `${number}: ${input.title}`,
    });

    await this.notifications.notify({
      userIds: [
        ...(await this.notifications.userIdsWithRole("fachbereichsadmin")),
        ...(await this.notifications.userIdsWithRole("admin")),
      ],
      title: `Neue Serviceanfrage ${number}`,
      detail: `${input.title} (${input.category})`,
      link: "/tickets",
    });

    return this.toTicket(ticket, true);
  }

  async updateTicket(
    user: RequestUser,
    id: string,
    input: { status?: TicketStatus; priority?: Priority; assigneeId?: string | null },
  ): Promise<TicketSummary> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: { id: true, number: true, requesterId: true },
    });
    if (!ticket) {
      throw new NotFoundException("Ticket nicht gefunden");
    }
    if (!can(user, "tickets.manage")) {
      throw new ForbiddenException("Tickets werden vom Fachbereich bearbeitet.");
    }

    // Dieselbe Falle wie bei der Raumbuchung: Personenkennungen sind über alle
    // Häuser eindeutig, der Fremdschlüssel nimmt also auch eine fremde an. Der
    // gefilterte Zugriff findet nur Personen des eigenen Hauses.
    if (input.assigneeId) {
      const zustaendig = await this.prisma.user.findFirst({
        where: { id: input.assigneeId, status: "active" },
        select: { id: true },
      });
      if (!zustaendig) {
        throw new NotFoundException("Die zuständige Person wurde nicht gefunden.");
      }
    }

    const updated = await this.prisma.ticket.update({
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
      action: "ticket.update",
      entityType: "ticket",
      entityId: id,
      detail: `${updated.number} aktualisiert (${updated.status})`,
    });

    await this.notifications.notify({
      userIds: [ticket.requesterId, ...(input.assigneeId ? [input.assigneeId] : [])],
      title: `Ticket ${updated.number} aktualisiert`,
      detail: `Status: ${updated.status}`,
      link: "/tickets",
    });

    return this.toTicket(updated, true);
  }

  async commentTicket(user: RequestUser, id: string, message: string): Promise<TicketSummary> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: { id: true, number: true, requesterId: true, assigneeId: true },
    });
    if (!ticket) {
      throw new NotFoundException("Ticket nicht gefunden");
    }
    if (ticket.requesterId !== user.id && ticket.assigneeId !== user.id && !can(user, "tickets.manage")) {
      throw new ForbiddenException("Kein Zugriff auf dieses Ticket.");
    }

    await this.prisma.ticketComment.create({ data: { ticketId: id, authorId: user.id, message } });

    await this.notifications.notify({
      userIds: [ticket.requesterId, ticket.assigneeId ?? ""].filter((entry) => entry && entry !== user.id),
      title: `Neue Antwort zu ${ticket.number}`,
      detail: message.slice(0, 160),
      link: "/tickets",
    });

    return this.ticketDetail(user, id);
  }

  /* ------------------------------------------------------------ Ideen */

  async ideas(user: RequestUser, filter: { status?: string; search?: string } = {}) {
    const ideas = await this.prisma.idea.findMany({
      where: {
        ...(filter.status && filter.status !== "all" ? { status: filter.status as IdeaStatus } : {}),
        ...(filter.search
          ? {
              OR: [
                { title: { contains: filter.search, mode: "insensitive" } },
                { description: { contains: filter.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { ...ideaInclude, votes: { where: { userId: user.id }, select: { id: true } } },
      orderBy: [{ votes: { _count: "desc" } }, { createdAt: "desc" }],
    });

    return {
      items: ideas.map((idea) => this.toIdea(idea, idea.votes.length > 0)),
      canManage: can(user, "tickets.manage"),
    };
  }

  async createIdea(user: RequestUser, input: { title: string; description: string; category: string }): Promise<Idea> {
    const idea = await this.prisma.idea.create({
      data: { title: input.title, description: input.description, category: input.category, authorId: user.id },
      include: ideaInclude,
    });

    await this.audit.log({
      actor: user,
      action: "idea.create",
      entityType: "idea",
      entityId: idea.id,
      detail: `Idee "${idea.title}" eingereicht`,
    });

    return this.toIdea({ ...idea, votes: [] }, false);
  }

  /** Stimme abgeben oder zurückziehen. */
  async toggleVote(user: RequestUser, ideaId: string): Promise<Idea> {
    const existing = await this.prisma.ideaVote.findUnique({
      where: { tenantId_ideaId_userId: { tenantId: requireTenantId(), ideaId, userId: user.id } },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.ideaVote.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.ideaVote.create({ data: { ideaId, userId: user.id } });
    }

    const idea = await this.prisma.idea.findUniqueOrThrow({ where: { id: ideaId }, include: ideaInclude });
    return this.toIdea({ ...idea, votes: [] }, !existing);
  }

  async setIdeaStatus(user: RequestUser, id: string, status: IdeaStatus, decisionNote?: string): Promise<Idea> {
    if (!can(user, "tickets.manage")) {
      throw new ForbiddenException("Nur der Fachbereich entscheidet über Ideen.");
    }

    const idea = await this.prisma.idea.update({
      where: { id },
      data: { status, decisionNote: decisionNote ?? null },
      include: ideaInclude,
    });

    await this.audit.log({
      actor: user,
      action: "idea.status",
      entityType: "idea",
      entityId: id,
      detail: `Idee "${idea.title}" auf "${status}" gesetzt`,
    });

    await this.notifications.notify({
      userIds: [idea.authorId],
      title: `Ihre Idee wurde bewertet: ${status}`,
      detail: decisionNote ?? idea.title,
      link: "/ideen",
    });

    return this.toIdea({ ...idea, votes: [] }, false);
  }

  /* --------------------------------------------------------- Umfragen */

  async polls(user: RequestUser, includeClosed = false) {
    const polls = await this.prisma.poll.findMany({
      where: includeClosed ? {} : { isActive: true, OR: [{ closesAt: null }, { closesAt: { gte: new Date() } }] },
      include: { ...pollInclude, votes: { where: { userId: user.id }, select: { optionId: true } } },
      orderBy: { createdAt: "desc" },
    });

    return {
      items: polls.map((poll) => this.toPoll(poll, poll.votes[0]?.optionId ?? null)),
      canManage: can(user, "tickets.manage"),
    };
  }

  async createPoll(
    user: RequestUser,
    input: { question: string; description?: string; options: string[]; closesAt?: string },
  ): Promise<Poll> {
    const options = input.options.map((option) => option.trim()).filter(Boolean);
    if (options.length < 2) {
      throw new BadRequestException("Eine Umfrage braucht mindestens zwei Antwortmöglichkeiten.");
    }

    const poll = await this.prisma.poll.create({
      data: {
        question: input.question,
        description: input.description ?? null,
        closesAt: input.closesAt ? new Date(input.closesAt) : null,
        authorId: user.id,
        options: { create: options.map((label, index) => ({ label, sortOrder: index })) },
      },
      include: pollInclude,
    });

    await this.audit.log({
      actor: user,
      action: "poll.create",
      entityType: "poll",
      entityId: poll.id,
      detail: `Umfrage "${poll.question}" gestartet`,
    });

    return this.toPoll({ ...poll, votes: [] }, null);
  }

  /** Eine Stimme pro Person; erneutes Abstimmen ändert die Auswahl. */
  async vote(user: RequestUser, pollId: string, optionId: string): Promise<Poll> {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: { select: { id: true } } },
    });
    if (!poll) {
      throw new NotFoundException("Umfrage nicht gefunden");
    }
    if (!poll.isActive || (poll.closesAt && poll.closesAt < new Date())) {
      throw new BadRequestException("Diese Umfrage ist beendet.");
    }
    if (!poll.options.some((option) => option.id === optionId)) {
      throw new BadRequestException("Die gewählte Antwort gehört nicht zu dieser Umfrage.");
    }

    await this.prisma.pollVote.upsert({
      where: { tenantId_pollId_userId: { tenantId: requireTenantId(), pollId, userId: user.id } },
      update: { optionId },
      create: { pollId, optionId, userId: user.id },
    });

    const updated = await this.prisma.poll.findUniqueOrThrow({ where: { id: pollId }, include: pollInclude });
    return this.toPoll({ ...updated, votes: [] }, optionId);
  }

  async closePoll(user: RequestUser, id: string): Promise<Poll> {
    if (!can(user, "tickets.manage")) {
      throw new ForbiddenException("Nur der Fachbereich kann Umfragen schließen.");
    }
    const poll = await this.prisma.poll.update({ where: { id }, data: { isActive: false }, include: pollInclude });
    await this.audit.log({
      actor: user,
      action: "poll.close",
      entityType: "poll",
      entityId: id,
      detail: `Umfrage "${poll.question}" geschlossen`,
    });
    return this.toPoll({ ...poll, votes: [] }, null);
  }

  /* ---------------------------------------------------------- Mapper */

  private toTicket(
    ticket: Prisma.TicketGetPayload<{ include: typeof ticketInclude }>,
    withComments: boolean,
  ): TicketSummary {
    return {
      id: ticket.id,
      number: ticket.number,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      requester: displayName(ticket.requester),
      requesterUsername: ticket.requester.username,
      assignee: ticket.assignee ? displayName(ticket.assignee) : null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      commentCount: ticket._count.comments,
      ...(withComments
        ? {
            comments: ticket.comments.map((comment) => ({
              id: comment.id,
              author: displayName(comment.author),
              message: comment.message,
              createdAt: comment.createdAt.toISOString(),
            })),
          }
        : {}),
    };
  }

  private toIdea(
    idea: Prisma.IdeaGetPayload<{ include: typeof ideaInclude }> & { votes?: unknown[] },
    votedByMe: boolean,
  ): Idea {
    return {
      id: idea.id,
      title: idea.title,
      description: idea.description,
      category: idea.category,
      status: idea.status,
      author: displayName(idea.author),
      authorUsername: idea.author.username,
      createdAt: idea.createdAt.toISOString(),
      voteCount: idea._count.votes,
      votedByMe,
      decisionNote: idea.decisionNote,
    };
  }

  private toPoll(
    poll: Prisma.PollGetPayload<{ include: typeof pollInclude }> & { votes?: unknown[] },
    myOptionId: string | null,
  ): Poll {
    return {
      id: poll.id,
      question: poll.question,
      description: poll.description,
      closesAt: poll.closesAt?.toISOString() ?? null,
      isActive: poll.isActive && (!poll.closesAt || poll.closesAt >= new Date()),
      options: poll.options.map((option) => ({
        id: option.id,
        label: option.label,
        votes: option._count.votes,
      })),
      totalVotes: poll._count.votes,
      myOptionId,
    };
  }
}
