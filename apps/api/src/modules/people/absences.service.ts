import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type AbsenceStatus, type AbsenceType } from "../../generated/prisma/client";
import type { Absence, AbsenceBalance, AbwesenheitsKalender, ErfassbarePerson } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { NotificationsService } from "../../core/notifications.service";
import { displayName, toIso } from "../../core/mappers";
import { can, type RequestUser } from "../../core/request-user";
import { PeopleService } from "./people.service";
import { alleUnterstellten } from "./organigramm";
import { anfangsstatus, arbeitstage, darfErfassen, freieTage } from "./abwesenheitsregeln";

const absenceInclude = {
  user: { select: { username: true, firstName: true, lastName: true } },
  decider: { select: { firstName: true, lastName: true } },
  recordedBy: { select: { firstName: true, lastName: true } },
} as const;

const TYPE_LABELS: Record<AbsenceType, string> = {
  urlaub: "Urlaub",
  krank: "Krankmeldung",
  gleitzeit: "Gleitzeit",
  sonderurlaub: "Sonderurlaub",
  fortbildung: "Fortbildung / Schulung",
};

export interface AbsenceInput {
  type: AbsenceType;
  startDate: string;
  endDate: string;
  note?: string;
  /** Für wen eingetragen wird. Fehlt die Angabe: für die anfragende Person selbst. */
  userId?: string;
  startHalb?: boolean;
  endHalb?: boolean;
}

@Injectable()
export class AbsencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly people: PeopleService,
  ) {}

  /** Alle Konten mit ihrem Vorgesetzten - Grundlage für die Frage, wer wen betreuen darf. */
  private personen() {
    return this.prisma.user.findMany({ select: { id: true, managerId: true } });
  }

  /**
   * Eigene Anträge, plus die des Teams für alle mit Freigaberecht.
   *
   * Zwei Rechte, weil es zwei Fälle sind: die Führungskraft sieht ihre
   * Unterstellten (auch mittelbar), die Verwaltung das ganze Haus.
   */
  async list(user: RequestUser, filter: { scope?: "mine" | "team"; status?: string } = {}) {
    const darfAlle = can(user, "absences.viewAll");
    const canSeeTeam = darfAlle || can(user, "absences.approve");
    const scope = filter.scope ?? "mine";

    let wer: Prisma.AbsenceWhereInput = { userId: user.id };
    if (scope === "team" && canSeeTeam) {
      wer = darfAlle ? {} : { userId: { in: alleUnterstellten(await this.personen(), user.id) } };
    }

    const rows = await this.prisma.absence.findMany({
      where: {
        ...wer,
        ...(filter.status && filter.status !== "all" ? { status: filter.status as AbsenceStatus } : {}),
      },
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

  /** Personen, für die der Akteur Abwesenheiten eintragen darf - ohne ihn selbst. */
  async erfassbar(user: RequestUser): Promise<ErfassbarePerson[]> {
    if (!can(user, "absences.approve")) {
      return [];
    }
    const ids = can(user, "absences.viewAll") ? null : alleUnterstellten(await this.personen(), user.id);
    const rows = await this.prisma.user.findMany({
      where: { status: "active", id: ids ? { in: ids } : { not: user.id } },
      select: { id: true, firstName: true, lastName: true, loginEnabled: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return rows.map((row) => ({ id: row.id, displayName: displayName(row), hasAccess: row.loginEnabled }));
  }

  /**
   * Trägt eine Abwesenheit ein - für sich oder, mit Freigaberecht, für Unterstellte.
   *
   * Krankmeldungen und Einträge für andere gelten sofort: wer sich krank meldet,
   * braucht keine Erlaubnis, und die Führungskraft, die für eine Person ohne
   * Zugang einträgt, ist die Freigabe. Nur der eigene Urlaubsantrag wartet.
   */
  async create(user: RequestUser, input: AbsenceInput): Promise<Absence> {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException("Bitte geben Sie gültige Daten an.");
    }
    if (end < start) {
      throw new BadRequestException("Das Enddatum darf nicht vor dem Startdatum liegen.");
    }

    const zielId = input.userId || user.id;
    const fuerAndere = zielId !== user.id;
    if (fuerAndere) {
      const erlaubt = darfErfassen({
        akteurId: user.id,
        zielId,
        personen: await this.personen(),
        darfFreigeben: can(user, "absences.approve"),
        sieheAlle: can(user, "absences.viewAll"),
      });
      if (!erlaubt) {
        throw new ForbiddenException("Sie dürfen für diese Person keine Abwesenheit eintragen.");
      }
    }

    const ziel = await this.prisma.user.findFirst({
      where: { id: zielId, status: "active" },
      select: { id: true, firstName: true, lastName: true, locationId: true, loginEnabled: true },
    });
    if (!ziel) {
      throw new BadRequestException("Die Person ist in diesem Haus nicht verfügbar.");
    }

    const workingDays = arbeitstage({
      von: start,
      bis: end,
      freieTage: await this.freieTageFuer(ziel.locationId, start, end),
      startHalb: input.startHalb,
      endHalb: input.endHalb,
    });
    if (workingDays === 0) {
      throw new BadRequestException("Der gewählte Zeitraum enthält keine Arbeitstage.");
    }

    // Überschneidungen mit bereits laufenden Anträgen verhindern.
    const overlap = await this.prisma.absence.findFirst({
      where: {
        userId: ziel.id,
        status: { in: ["submitted", "approved"] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new BadRequestException("Für diesen Zeitraum existiert bereits ein Antrag.");
    }

    const status = anfangsstatus({ art: input.type, fuerAndere });
    const absence = await this.prisma.absence.create({
      data: {
        userId: ziel.id,
        type: input.type,
        startDate: start,
        endDate: end,
        workingDays,
        startHalb: input.startHalb ?? false,
        endHalb: input.endHalb ?? false,
        note: input.note ?? null,
        status,
        recordedById: status === "approved" ? user.id : null,
      },
      include: absenceInclude,
    });

    const wer = displayName(ziel);
    await this.audit.log({
      actor: user,
      action: fuerAndere ? "absence.record_for" : "absence.create",
      entityType: "absence",
      entityId: absence.id,
      detail:
        `${TYPE_LABELS[absence.type]} vom ${input.startDate} bis ${input.endDate} (${workingDays} Arbeitstage)` +
        (fuerAndere ? ` für ${wer} eingetragen` : ""),
    });

    if (status === "submitted") {
      await this.notifications.notify({
        userIds: await this.people.approversFor(ziel.id),
        title: `Abwesenheitsantrag von ${wer}`,
        detail: `${TYPE_LABELS[absence.type]}, ${workingDays} Arbeitstage`,
        link: "/abwesenheiten",
      });
    } else if (fuerAndere) {
      // Wer den Eintrag nicht selbst vorgenommen hat, soll ihn sehen können - sonst
      // steht etwas in seinem Namen, von dem er nichts weiß. Ohne Zugang gibt es niemanden zu benachrichtigen.
      if (ziel.loginEnabled) {
        await this.notifications.notify({
          userIds: [ziel.id],
          title: "Abwesenheit für Sie eingetragen",
          detail: `${TYPE_LABELS[absence.type]} von ${user.displayName}, ${workingDays} Arbeitstage`,
          link: "/abwesenheiten",
          auchPerMail: true,
        });
      }
    } else {
      await this.notifications.notify({
        userIds: await this.people.approversFor(ziel.id),
        title: `${TYPE_LABELS[absence.type]} von ${wer}`,
        detail: `${workingDays} Arbeitstage - zur Kenntnis`,
        link: "/abwesenheiten",
      });
    }

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
    if (!can(user, "absences.viewAll") && !approvers.includes(user.id)) {
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
      auchPerMail: true,
    });

    return this.toAbsence(updated);
  }

  /** Stornieren darf die Person selbst, wer sie betreut (Unterstellte) und die Verwaltung. */
  async cancel(user: RequestUser, id: string): Promise<Absence> {
    const absence = await this.prisma.absence.findUnique({ where: { id }, include: absenceInclude });
    if (!absence) {
      throw new NotFoundException("Antrag nicht gefunden");
    }
    const erlaubt =
      absence.userId === user.id ||
      can(user, "absences.viewAll") ||
      darfErfassen({
        akteurId: user.id,
        zielId: absence.userId,
        personen: await this.personen(),
        darfFreigeben: can(user, "absences.approve"),
        sieheAlle: false,
      });
    if (!erlaubt) {
      throw new ForbiddenException("Nur die antragstellende Person oder ihre Führungskraft kann stornieren.");
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
      detail: `Antrag ${TYPE_LABELS[absence.type]} von ${displayName(absence.user)} storniert`,
    });

    return this.toAbsence(updated);
  }

  /**
   * Teamkalender: wer fehlt wann.
   *
   * Wer nichts freigeben darf, sieht nur sich selbst - die Art einer
   * Abwesenheit (auch Krankheit) geht an Kolleginnen nur, wenn das Haus es über
   * Rechte so vorsieht. Führungskräfte sehen ihre Unterstellten, die Verwaltung alle.
   */
  async kalender(user: RequestUser, vonText: string, bisText: string): Promise<AbwesenheitsKalender> {
    const von = new Date(`${vonText}T00:00:00Z`);
    const bis = new Date(`${bisText}T00:00:00Z`);
    if (Number.isNaN(von.getTime()) || Number.isNaN(bis.getTime()) || bis < von) {
      throw new BadRequestException("Bitte einen gültigen Zeitraum angeben.");
    }
    if (bis.getTime() - von.getTime() > 62 * 86_400_000) {
      throw new BadRequestException("Der Kalender zeigt höchstens zwei Monate.");
    }

    let sichtbar: Prisma.UserWhereInput;
    if (can(user, "absences.viewAll")) {
      sichtbar = {};
    } else if (can(user, "absences.approve")) {
      sichtbar = { id: { in: [user.id, ...alleUnterstellten(await this.personen(), user.id)] } };
    } else {
      sichtbar = { id: user.id };
    }

    const [personen, tage] = await Promise.all([
      this.prisma.user.findMany({
        where: { status: "active", ...sichtbar },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          loginEnabled: true,
          location: { select: { name: true } },
          absences: {
            where: { status: { in: ["submitted", "approved"] }, startDate: { lte: bis }, endDate: { gte: von } },
            orderBy: { startDate: "asc" },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      this.prisma.betriebstag.findMany({
        where: { datum: { gte: von, lte: bis } },
        orderBy: { datum: "asc" },
      }),
    ]);

    return {
      von: vonText,
      bis: bisText,
      personen: personen.map((person) => ({
        id: person.id,
        name: displayName(person),
        hasAccess: person.loginEnabled,
        location: person.location?.name ?? null,
        eintraege: person.absences.map((absence) => ({
          id: absence.id,
          art: absence.type,
          status: absence.status,
          von: absence.startDate.toISOString().slice(0, 10),
          bis: absence.endDate.toISOString().slice(0, 10),
          startHalb: absence.startHalb,
          endHalb: absence.endHalb,
        })),
      })),
      tage: tage.map((tag) => ({
        datum: tag.datum.toISOString().slice(0, 10),
        locationId: tag.locationId,
        arbeitsfrei: tag.arbeitsfrei,
        name: tag.name,
      })),
    };
  }

  /** Freie Tage des Betriebskalenders im Zeitraum, für den Standort der Person. */
  private async freieTageFuer(locationId: string | null, von: Date, bis: Date): Promise<Set<string>> {
    const rows = await this.prisma.betriebstag.findMany({
      where: { datum: { gte: von, lte: bis } },
      select: { datum: true, arbeitsfrei: true, locationId: true },
    });
    return freieTage(
      rows.map((row) => ({
        datum: row.datum.toISOString().slice(0, 10),
        arbeitsfrei: row.arbeitsfrei,
        locationId: row.locationId,
      })),
      locationId,
    );
  }

  private toAbsence(row: Prisma.AbsenceGetPayload<{ include: typeof absenceInclude }>): Absence {
    return {
      id: row.id,
      employee: displayName(row.user),
      employeeId: row.userId,
      employeeUsername: row.user.username,
      type: row.type,
      startDate: row.startDate.toISOString(),
      endDate: row.endDate.toISOString(),
      workingDays: row.workingDays,
      startHalb: row.startHalb,
      endHalb: row.endHalb,
      status: row.status,
      note: row.note,
      decidedBy: row.decider ? displayName(row.decider) : null,
      decidedAt: toIso(row.decidedAt),
      recordedBy: row.recordedBy ? displayName(row.recordedBy) : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
