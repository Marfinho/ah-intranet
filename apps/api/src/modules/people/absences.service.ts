import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type AbsenceStatus, type AbsenceType } from "@prisma/client";
import type { Absence, AbsenceBalance } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { NotificationsService } from "../../core/notifications.service";
import { displayName, toIso, workingDaysBetween } from "../../core/mappers";
import { hasRole, isManaging, type RequestUser } from "../../core/request-user";
import { PeopleService } from "./people.service";

const absenceInclude = {
  user: { select: { username: true, firstName: true, lastName: true } },
  decider: { select: { firstName: true, lastName: true } },
} as const;

const TYPE_LABELS: Record<AbsenceType, string> = {
  urlaub: "Urlaub",
  krank: "Krankmeldung",
  gleitzeit: "Gleitzeit",
  sonderurlaub: "Sonderurlaub",
  fortbildung: "Fortbildung",
};

@Injectable()
export class AbsencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly people: PeopleService,
  ) {}

  /** Eigene Anträge, plus die des Teams für Führungskräfte und Admins. */
  async list(user: RequestUser, filter: { scope?: "mine" | "team"; status?: string } = {}) {
    const canSeeTeam = isManaging(user) || hasRole(user, "fuehrungskraft");
    const scope = filter.scope ?? "mine";

    const where: Prisma.AbsenceWhereInput = {
      ...(scope === "team" && canSeeTeam
        ? isManaging(user)
          ? {}
          : { user: { managerId: user.id } }
        : { userId: user.id }),
      ...(filter.status && filter.status !== "all" ? { status: filter.status as AbsenceStatus } : {}),
    };

    const rows = await this.prisma.absence.findMany({
      where,
      include: absenceInclude,
      orderBy: { startDate: "desc" },
      take: 200,
    });

    return { items: rows.map((row) => this.toAbsence(row)), canSeeTeam };
  }

  async balance(user: RequestUser): Promise<AbsenceBalance> {
    const profile = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { annualLeaveDays: true },
    });

    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const yearEnd = new Date(Date.UTC(new Date().getUTCFullYear(), 11, 31));

    const grouped = await this.prisma.absence.groupBy({
      by: ["status"],
      where: { userId: user.id, type: "urlaub", startDate: { gte: yearStart, lte: yearEnd } },
      _sum: { workingDays: true },
    });

    const approved = grouped.find((entry) => entry.status === "approved")?._sum.workingDays ?? 0;
    const pending = grouped.find((entry) => entry.status === "submitted")?._sum.workingDays ?? 0;

    return {
      annualEntitlement: profile.annualLeaveDays,
      approved,
      pending,
      remaining: profile.annualLeaveDays - approved - pending,
    };
  }

  async create(
    user: RequestUser,
    input: { type: AbsenceType; startDate: string; endDate: string; note?: string },
  ): Promise<Absence> {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException("Bitte geben Sie gültige Daten an.");
    }
    if (end < start) {
      throw new BadRequestException("Das Enddatum darf nicht vor dem Startdatum liegen.");
    }

    const workingDays = workingDaysBetween(start, end);
    if (workingDays === 0) {
      throw new BadRequestException("Der gewählte Zeitraum enthält keine Arbeitstage.");
    }

    // Überschneidungen mit bereits laufenden Anträgen verhindern.
    const overlap = await this.prisma.absence.findFirst({
      where: {
        userId: user.id,
        status: { in: ["submitted", "approved"] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new BadRequestException("Für diesen Zeitraum existiert bereits ein Antrag.");
    }

    const absence = await this.prisma.absence.create({
      data: {
        userId: user.id,
        type: input.type,
        startDate: start,
        endDate: end,
        workingDays,
        note: input.note ?? null,
        status: "submitted",
      },
      include: absenceInclude,
    });

    await this.audit.log({
      actor: user,
      action: "absence.create",
      entityType: "absence",
      entityId: absence.id,
      detail: `${TYPE_LABELS[absence.type]} vom ${input.startDate} bis ${input.endDate} (${workingDays} Arbeitstage)`,
    });

    await this.notifications.notify({
      userIds: await this.people.approversFor(user.id),
      title: `Abwesenheitsantrag von ${user.displayName}`,
      detail: `${TYPE_LABELS[absence.type]}, ${workingDays} Arbeitstage`,
      link: "/abwesenheiten",
    });

    return this.toAbsence(absence);
  }

  async decide(user: RequestUser, id: string, approve: boolean, note?: string): Promise<Absence> {
    const absence = await this.prisma.absence.findUnique({ where: { id }, include: absenceInclude });
    if (!absence) {
      throw new NotFoundException("Antrag nicht gefunden");
    }
    if (absence.status !== "submitted") {
      throw new BadRequestException("Über diesen Antrag wurde bereits entschieden.");
    }

    const approvers = await this.people.approversFor(absence.userId);
    if (!isManaging(user) && !approvers.includes(user.id)) {
      throw new ForbiddenException("Sie sind für diesen Antrag nicht freigabeberechtigt.");
    }

    const updated = await this.prisma.absence.update({
      where: { id },
      data: {
        status: approve ? "approved" : "rejected",
        deciderId: user.id,
        decidedAt: new Date(),
        note: note ?? absence.note,
      },
      include: absenceInclude,
    });

    await this.audit.log({
      actor: user,
      action: approve ? "absence.approve" : "absence.reject",
      entityType: "absence",
      entityId: id,
      detail: `Antrag von ${displayName(absence.user)} ${approve ? "genehmigt" : "abgelehnt"}`,
    });

    await this.notifications.notify({
      userIds: [absence.userId],
      title: `Abwesenheitsantrag ${approve ? "genehmigt" : "abgelehnt"}`,
      detail: note ?? `${TYPE_LABELS[absence.type]}, ${absence.workingDays} Arbeitstage`,
      link: "/abwesenheiten",
    });

    return this.toAbsence(updated);
  }

  async cancel(user: RequestUser, id: string): Promise<Absence> {
    const absence = await this.prisma.absence.findUnique({ where: { id }, include: absenceInclude });
    if (!absence) {
      throw new NotFoundException("Antrag nicht gefunden");
    }
    if (absence.userId !== user.id && !isManaging(user)) {
      throw new ForbiddenException("Nur die antragstellende Person kann stornieren.");
    }
    if (absence.status === "cancelled") {
      return this.toAbsence(absence);
    }

    const updated = await this.prisma.absence.update({
      where: { id },
      data: { status: "cancelled" },
      include: absenceInclude,
    });

    await this.audit.log({
      actor: user,
      action: "absence.cancel",
      entityType: "absence",
      entityId: id,
      detail: `Antrag ${TYPE_LABELS[absence.type]} storniert`,
    });

    return this.toAbsence(updated);
  }

  private toAbsence(row: Prisma.AbsenceGetPayload<{ include: typeof absenceInclude }>): Absence {
    return {
      id: row.id,
      employee: displayName(row.user),
      employeeUsername: row.user.username,
      type: row.type,
      startDate: row.startDate.toISOString(),
      endDate: row.endDate.toISOString(),
      workingDays: row.workingDays,
      status: row.status,
      note: row.note,
      decidedBy: row.decider ? displayName(row.decider) : null,
      decidedAt: toIso(row.decidedAt),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
