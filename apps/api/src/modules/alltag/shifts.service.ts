import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { ShiftItem, ShiftSwapItem, ShiftSwapStatus } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { pruefeReferenzen } from "../../core/referenzen";
import { AuditService } from "../../core/audit.service";
import { NotificationsService } from "../../core/notifications.service";
import { displayName, toIso } from "../../core/mappers";
import { can, type RequestUser } from "../../core/request-user";
import { tauschrechte, ueberschneidet } from "./regeln";

const shiftInclude = {
  location: { select: { name: true } },
  department: { select: { name: true } },
  assignee: { select: { firstName: true, lastName: true, username: true } },
  swaps: { where: { status: { in: ["offen", "angenommen"] as ShiftSwapStatus[] } }, select: { id: true } },
} as const;

const swapInclude = {
  shift: { select: { id: true, label: true, startsAt: true, endsAt: true } },
  requester: { select: { firstName: true, lastName: true, username: true } },
  target: { select: { firstName: true, lastName: true, username: true } },
  decidedBy: { select: { firstName: true, lastName: true } },
} as const;

export interface ShiftInput {
  label: string;
  startsAt: string;
  endsAt: string;
  locationId?: string | null;
  departmentId?: string | null;
  assigneeId?: string | null;
  note?: string | null;
}

/**
 * Schichtplan mit Diensttausch.
 *
 * Der Tausch läuft in zwei Stufen: erst stimmt die angefragte Person zu, dann
 * gibt die Führungskraft frei. Eine einzige Freigabe würde entweder jemandem
 * eine Schicht aufdrücken oder die Besetzung an der Leitung vorbei ändern -
 * beides ist im Betrieb nicht tragbar.
 */
@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ---------------------------------------------------------- Schichten */

  async list(user: RequestUser, filter: { from?: string; to?: string; mine?: boolean } = {}): Promise<ShiftItem[]> {
    const von = filter.from ? new Date(filter.from) : new Date();
    const bis = filter.to ? new Date(filter.to) : new Date(von.getTime() + 28 * 24 * 60 * 60 * 1000);

    const shifts = await this.prisma.shift.findMany({
      where: {
        startsAt: { gte: this.tagesbeginn(von), lte: this.tagesende(bis) },
        ...(filter.mine ? { assigneeId: user.id } : {}),
      },
      include: shiftInclude,
      orderBy: [{ startsAt: "asc" }, { label: "asc" }],
    });

    return shifts.map((shift) => this.toItem(shift, user));
  }

  async create(user: RequestUser, input: ShiftInput): Promise<ShiftItem> {
    const { startsAt, endsAt } = this.pruefeZeitraum(input);
    await this.pruefeZuordnung(input);
    await this.pruefeDoppelbelegung(input.assigneeId ?? null, startsAt, endsAt, null);

    const shift = await this.prisma.shift.create({
      data: {
        label: input.label.trim(),
        startsAt,
        endsAt,
        locationId: input.locationId || null,
        departmentId: input.departmentId || null,
        assigneeId: input.assigneeId || null,
        note: input.note?.trim() || null,
        createdById: user.id,
      },
      include: shiftInclude,
    });

    await this.audit.log({
      actor: user,
      action: "shift.created",
      entityType: "shift",
      entityId: shift.id,
      detail: `Schicht "${shift.label}" am ${this.datum(startsAt)} angelegt`,
    });

    if (shift.assigneeId) {
      await this.benachrichtige([shift.assigneeId], `Neue Schicht: ${shift.label}`, this.zeitraum(shift), shift.id);
    }

    return this.toItem(shift, user);
  }

  async update(user: RequestUser, id: string, input: Partial<ShiftInput>): Promise<ShiftItem> {
    const vorhanden = await this.prisma.shift.findUnique({ where: { id } });
    if (!vorhanden) {
      throw new NotFoundException("Schicht nicht gefunden");
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : vorhanden.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : vorhanden.endsAt;
    if (endsAt <= startsAt) {
      throw new BadRequestException("Das Ende der Schicht muss nach dem Beginn liegen.");
    }

    await this.pruefeZuordnung(input);

    const kuenftigerAssignee = input.assigneeId === undefined ? vorhanden.assigneeId : input.assigneeId || null;
    await this.pruefeDoppelbelegung(kuenftigerAssignee, startsAt, endsAt, id);

    const shift = await this.prisma.shift.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label.trim() } : {}),
        ...(input.startsAt !== undefined ? { startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt } : {}),
        ...(input.locationId !== undefined ? { locationId: input.locationId || null } : {}),
        ...(input.departmentId !== undefined ? { departmentId: input.departmentId || null } : {}),
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId || null } : {}),
        ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
      },
      include: shiftInclude,
    });

    await this.audit.log({
      actor: user,
      action: "shift.updated",
      entityType: "shift",
      entityId: id,
      detail: `Schicht "${shift.label}" am ${this.datum(shift.startsAt)} geändert`,
    });

    // Nur die neu eingeteilte Person erfährt es; wer weichen musste, ebenso.
    const betroffene = [vorhanden.assigneeId, shift.assigneeId].filter(
      (eintrag): eintrag is string => Boolean(eintrag) && vorhanden.assigneeId !== shift.assigneeId,
    );
    if (betroffene.length > 0) {
      await this.benachrichtige(betroffene, `Schichtplan geändert: ${shift.label}`, this.zeitraum(shift), shift.id);
    }

    return this.toItem(shift, user);
  }

  async remove(user: RequestUser, id: string): Promise<void> {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) {
      throw new NotFoundException("Schicht nicht gefunden");
    }
    await this.prisma.shift.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: "shift.deleted",
      entityType: "shift",
      entityId: id,
      detail: `Schicht "${shift.label}" am ${this.datum(shift.startsAt)} entfernt`,
    });
    if (shift.assigneeId) {
      await this.benachrichtige([shift.assigneeId], `Schicht entfallen: ${shift.label}`, this.zeitraum(shift), null);
    }
  }

  /* ------------------------------------------------------- Diensttausch */

  async swaps(user: RequestUser, filter: { offen?: boolean } = {}): Promise<ShiftSwapItem[]> {
    const darfEntscheiden = can(user, "shifts.approve");

    const swaps = await this.prisma.shiftSwap.findMany({
      where: {
        // Wer nicht freigeben darf, sieht nur die eigenen Vorgänge - ein
        // Tauschwunsch sagt etwas über die Lebensumstände der Beteiligten.
        ...(darfEntscheiden ? {} : { OR: [{ requesterId: user.id }, { targetId: user.id }] }),
        ...(filter.offen ? { status: { in: ["offen", "angenommen"] } } : {}),
      },
      include: swapInclude,
      orderBy: { createdAt: "desc" },
    });

    return swaps.map((swap) => this.toSwap(swap, user, darfEntscheiden));
  }

  /** Bittet eine andere Person, die eigene Schicht zu übernehmen. */
  async requestSwap(user: RequestUser, shiftId: string, targetId: string, note?: string): Promise<ShiftSwapItem> {
    const shift = await this.prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) {
      throw new NotFoundException("Schicht nicht gefunden");
    }
    if (shift.assigneeId !== user.id) {
      throw new ForbiddenException("Abgeben kann nur, wer für die Schicht eingeteilt ist.");
    }
    if (targetId === user.id) {
      throw new BadRequestException("Eine Schicht lässt sich nicht mit sich selbst tauschen.");
    }
    if (shift.startsAt <= new Date()) {
      throw new BadRequestException("Für eine begonnene oder vergangene Schicht ist kein Tausch mehr möglich.");
    }

    const laeuft = await this.prisma.shiftSwap.findFirst({
      where: { shiftId, status: { in: ["offen", "angenommen"] } },
    });
    if (laeuft) {
      throw new BadRequestException("Für diese Schicht läuft bereits ein Tauschvorgang.");
    }

    // Die Zielperson muss im selben Haus und aktiv sein. Der Mandantenfilter
    // greift hier, weil die Kennung aus der Anfrage kommt.
    const ziel = await this.prisma.user.findFirst({ where: { id: targetId, status: "active" } });
    if (!ziel) {
      throw new BadRequestException("Die angefragte Person ist in diesem Haus nicht verfügbar.");
    }

    const swap = await this.prisma.shiftSwap.create({
      data: { shiftId, requesterId: user.id, targetId, note: note?.trim() || null },
      include: swapInclude,
    });

    await this.audit.log({
      actor: user,
      action: "shift_swap.requested",
      entityType: "shift_swap",
      entityId: swap.id,
      detail: `Tausch der Schicht "${shift.label}" am ${this.datum(shift.startsAt)} bei ${displayName(ziel)} angefragt`,
    });

    await this.benachrichtige(
      [targetId],
      `Diensttausch angefragt: ${shift.label}`,
      `${user.displayName} fragt, ob Sie ${this.zeitraum(shift)} übernehmen.`,
      shift.id,
    );

    return this.toSwap(swap, user, can(user, "shifts.approve"));
  }

  /** Antwort der angefragten Person. Zustimmung heißt noch nicht getauscht. */
  async respond(user: RequestUser, swapId: string, accept: boolean): Promise<ShiftSwapItem> {
    const swap = await this.prisma.shiftSwap.findUnique({ where: { id: swapId }, include: swapInclude });
    if (!swap) {
      throw new NotFoundException("Tauschvorgang nicht gefunden");
    }
    if (swap.targetId !== user.id) {
      throw new ForbiddenException("Über diese Anfrage entscheidet die angefragte Person.");
    }
    if (swap.status !== "offen") {
      throw new BadRequestException("Diese Anfrage ist bereits beantwortet.");
    }

    const aktualisiert = await this.prisma.shiftSwap.update({
      where: { id: swapId },
      data: { status: accept ? "angenommen" : "abgelehnt", respondedAt: new Date() },
      include: swapInclude,
    });

    await this.audit.log({
      actor: user,
      action: accept ? "shift_swap.accepted" : "shift_swap.declined",
      entityType: "shift_swap",
      entityId: swapId,
      detail: `Tausch der Schicht "${swap.shift.label}" ${accept ? "angenommen" : "abgelehnt"}`,
    });

    const empfaenger = accept ? [swap.requesterId, ...(await this.freigabeberechtigte())] : [swap.requesterId];
    await this.benachrichtige(
      empfaenger,
      accept ? `Tausch angenommen, Freigabe steht aus: ${swap.shift.label}` : `Tausch abgelehnt: ${swap.shift.label}`,
      accept
        ? `${user.displayName} übernimmt, sobald die Freigabe erteilt ist.`
        : `${user.displayName} kann die Schicht nicht übernehmen.`,
      swap.shift.id,
    );

    return this.toSwap(aktualisiert, user, can(user, "shifts.approve"));
  }

  /**
   * Freigabe durch die Führungskraft. Erst hier wechselt die Besetzung.
   *
   * Die Umbuchung und die Statusänderung liegen in einer Transaktion: eine
   * freigegebene Anfrage ohne umgebuchte Schicht wäre ein Plan, auf den sich
   * niemand verlassen kann.
   */
  async decide(user: RequestUser, swapId: string, approve: boolean, note?: string): Promise<ShiftSwapItem> {
    const swap = await this.prisma.shiftSwap.findUnique({ where: { id: swapId }, include: swapInclude });
    if (!swap) {
      throw new NotFoundException("Tauschvorgang nicht gefunden");
    }
    if (swap.status !== "angenommen") {
      throw new BadRequestException(
        "Freigeben lässt sich erst, wenn die angefragte Person zugestimmt hat - sonst wäre es eine Zuteilung.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.shiftSwap.update({
        where: { id: swapId },
        data: {
          status: approve ? "freigegeben" : "abgelehnt",
          decidedById: user.id,
          decidedAt: new Date(),
          decisionNote: note?.trim() || null,
        },
      });
      if (approve) {
        await tx.shift.update({ where: { id: swap.shiftId }, data: { assigneeId: swap.targetId } });
      }
    });

    await this.audit.log({
      actor: user,
      action: approve ? "shift_swap.approved" : "shift_swap.rejected",
      entityType: "shift_swap",
      entityId: swapId,
      detail: `Tausch der Schicht "${swap.shift.label}" am ${this.datum(swap.shift.startsAt)} ${
        approve ? "freigegeben" : "abgelehnt"
      }`,
    });

    await this.benachrichtige(
      [swap.requesterId, swap.targetId],
      approve ? `Tausch freigegeben: ${swap.shift.label}` : `Tausch nicht freigegeben: ${swap.shift.label}`,
      note?.trim() || (approve ? "Die Schicht ist umgetragen." : "Die Besetzung bleibt wie geplant."),
      swap.shift.id,
    );

    const aktualisiert = await this.prisma.shiftSwap.findUniqueOrThrow({
      where: { id: swapId },
      include: swapInclude,
    });
    return this.toSwap(aktualisiert, user, true);
  }

  async withdraw(user: RequestUser, swapId: string): Promise<ShiftSwapItem> {
    const swap = await this.prisma.shiftSwap.findUnique({ where: { id: swapId }, include: swapInclude });
    if (!swap) {
      throw new NotFoundException("Tauschvorgang nicht gefunden");
    }
    if (swap.requesterId !== user.id) {
      throw new ForbiddenException("Zurückziehen kann nur, wer angefragt hat.");
    }
    if (swap.status !== "offen" && swap.status !== "angenommen") {
      throw new BadRequestException("Dieser Vorgang ist bereits abgeschlossen.");
    }

    const aktualisiert = await this.prisma.shiftSwap.update({
      where: { id: swapId },
      data: { status: "zurueckgezogen" },
      include: swapInclude,
    });

    await this.audit.log({
      actor: user,
      action: "shift_swap.withdrawn",
      entityType: "shift_swap",
      entityId: swapId,
      detail: `Tauschanfrage zur Schicht "${swap.shift.label}" zurückgezogen`,
    });

    await this.benachrichtige(
      [swap.targetId],
      `Tauschanfrage zurückgezogen: ${swap.shift.label}`,
      `${user.displayName} braucht die Vertretung nicht mehr.`,
      swap.shift.id,
    );

    return this.toSwap(aktualisiert, user, can(user, "shifts.approve"));
  }

  /* ------------------------------------------------------------- Helfer */

  /** Konten, die einen Tausch freigeben dürfen - über das Recht, nicht über eine Rolle. */
  private async freigabeberechtigte(): Promise<string[]> {
    const traeger = await this.prisma.userRole.findMany({
      where: {
        role: { permissions: { some: { permission: { key: "shifts.approve" } } } },
        user: { status: "active" },
      },
      select: { userId: true },
    });
    return [...new Set(traeger.map((eintrag) => eintrag.userId))];
  }

  /**
   * Verhindert, dass jemand zur selben Zeit an zwei Orten steht.
   *
   * Fachlich der häufigste Planungsfehler, und einer, der erst am Morgen der
   * Schicht auffällt - deshalb wird er beim Speichern abgewiesen.
   */
  /**
   * Standort, Abteilung und eingeteiltes Konto müssen zum eigenen Haus gehören.
   *
   * Ohne diese Prüfung könnte eine Kennung aus einem fremden Haus am Datensatz
   * landen; der Schichtplan gäbe danach über `include` den Namen der fremden
   * Person aus.
   */
  private async pruefeZuordnung(input: Partial<ShiftInput>): Promise<void> {
    await pruefeReferenzen([
      { modell: this.prisma.location, id: input.locationId, bezeichnung: "Der Standort" },
      { modell: this.prisma.department, id: input.departmentId, bezeichnung: "Die Abteilung" },
      {
        modell: this.prisma.user,
        id: input.assigneeId,
        bezeichnung: "Das eingeteilte Konto",
        zusatz: { status: "active" },
      },
    ]);
  }

  private async pruefeDoppelbelegung(
    assigneeId: string | null,
    startsAt: Date,
    endsAt: Date,
    ausgenommen: string | null,
  ): Promise<void> {
    if (!assigneeId) {
      return;
    }
    // Grob in der Datenbank vorsortieren, fein mit derselben Regel entscheiden,
    // die der Test kennt - sonst driften Abfrage und Regel auseinander.
    const kandidaten = await this.prisma.shift.findMany({
      where: {
        assigneeId,
        ...(ausgenommen ? { id: { not: ausgenommen } } : {}),
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { label: true, startsAt: true, endsAt: true },
    });
    const kollision = kandidaten.find((kandidat) => ueberschneidet(kandidat, { startsAt, endsAt }));
    if (kollision) {
      throw new BadRequestException(
        `Diese Person ist zur selben Zeit bereits für "${kollision.label}" am ${this.datum(
          kollision.startsAt,
        )} eingeteilt.`,
      );
    }
  }

  private pruefeZeitraum(input: ShiftInput): { startsAt: Date; endsAt: Date } {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException("Beginn und Ende müssen gültige Zeitpunkte sein.");
    }
    if (endsAt <= startsAt) {
      throw new BadRequestException("Das Ende der Schicht muss nach dem Beginn liegen.");
    }
    return { startsAt, endsAt };
  }

  private async benachrichtige(
    userIds: string[],
    title: string,
    detail: string,
    shiftId: string | null,
  ): Promise<void> {
    await this.notifications.notify({
      userIds,
      title,
      detail,
      link: shiftId ? "/schichtplan" : "/schichtplan",
    });
  }

  private datum(wert: Date): string {
    return wert.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  private zeitraum(shift: { startsAt: Date; endsAt: Date }): string {
    const zeit = (wert: Date) => wert.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    return `${this.datum(shift.startsAt)}, ${zeit(shift.startsAt)}–${zeit(shift.endsAt)} Uhr`;
  }

  private tagesbeginn(wert: Date): Date {
    const kopie = new Date(wert);
    kopie.setHours(0, 0, 0, 0);
    return kopie;
  }

  private tagesende(wert: Date): Date {
    const kopie = new Date(wert);
    kopie.setHours(23, 59, 59, 999);
    return kopie;
  }

  private toItem(
    shift: {
      id: string;
      label: string;
      startsAt: Date;
      endsAt: Date;
      note: string | null;
      assigneeId: string | null;
      location: { name: string } | null;
      department: { name: string } | null;
      assignee: { firstName: string; lastName: string; username: string } | null;
      swaps: { id: string }[];
    },
    user: RequestUser,
  ): ShiftItem {
    return {
      id: shift.id,
      label: shift.label,
      startsAt: toIso(shift.startsAt)!,
      endsAt: toIso(shift.endsAt)!,
      location: shift.location?.name ?? null,
      department: shift.department?.name ?? null,
      assignee: shift.assignee ? displayName(shift.assignee) : null,
      assigneeUsername: shift.assignee?.username ?? null,
      note: shift.note,
      mine: shift.assigneeId === user.id,
      openSwap: shift.swaps.length > 0,
    };
  }

  private toSwap(
    swap: {
      id: string;
      status: string;
      note: string | null;
      decisionNote: string | null;
      createdAt: Date;
      requesterId: string;
      targetId: string;
      shift: { id: string; label: string; startsAt: Date; endsAt: Date };
      requester: { firstName: string; lastName: string; username: string };
      target: { firstName: string; lastName: string; username: string };
      decidedBy: { firstName: string; lastName: string } | null;
    },
    user: RequestUser,
    darfEntscheiden: boolean,
  ): ShiftSwapItem {
    const status = swap.status as ShiftSwapStatus;
    return {
      id: swap.id,
      status,
      shift: {
        id: swap.shift.id,
        label: swap.shift.label,
        startsAt: toIso(swap.shift.startsAt)!,
        endsAt: toIso(swap.shift.endsAt)!,
      },
      requester: displayName(swap.requester),
      requesterUsername: swap.requester.username,
      target: displayName(swap.target),
      targetUsername: swap.target.username,
      note: swap.note,
      decidedBy: swap.decidedBy ? displayName(swap.decidedBy) : null,
      decisionNote: swap.decisionNote,
      createdAt: toIso(swap.createdAt)!,
      ...tauschrechte(status, { requesterId: swap.requesterId, targetId: swap.targetId }, user.id, darfEntscheiden),
    };
  }
}
