import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type CalendarCategory } from "@prisma/client";
import type { CalendarEvent, Room, RoomBooking } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { audienceFilter, displayName } from "../../core/mappers";
import { can, type RequestUser } from "../../core/request-user";

const eventInclude = { organizer: { select: { firstName: true, lastName: true } } } as const;
const roomBookingInclude = {
  room: { select: { name: true } },
  user: { select: { username: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /* --------------------------------------------------------- Kalender */

  async events(user: RequestUser, filter: { from?: string; to?: string; category?: string } = {}) {
    const from = filter.from ? new Date(filter.from) : new Date();
    const to = filter.to ? new Date(filter.to) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 120);

    const events = await this.prisma.calendarEvent.findMany({
      where: {
        startsAt: { gte: from, lte: to },
        ...(filter.category && filter.category !== "all" ? { category: filter.category as CalendarCategory } : {}),
        ...(can(user, "calendar.manage") ? {} : audienceFilter(user)),
      },
      include: eventInclude,
      orderBy: { startsAt: "asc" },
    });

    return events.map((event) => this.toEvent(event));
  }

  async createEvent(
    user: RequestUser,
    input: {
      title: string;
      category: CalendarCategory;
      startsAt: string;
      endsAt: string;
      location?: string;
      description?: string;
      audienceScopes: string[];
    },
  ): Promise<CalendarEvent> {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException("Das Ende muss nach dem Beginn liegen.");
    }

    const event = await this.prisma.calendarEvent.create({
      data: {
        title: input.title,
        category: input.category,
        startsAt,
        endsAt,
        location: input.location ?? null,
        description: input.description ?? null,
        audienceScopes: input.audienceScopes.length ? input.audienceScopes : ["global"],
        organizerId: user.id,
      },
      include: eventInclude,
    });

    await this.audit.log({
      actor: user,
      action: "calendar.create",
      entityType: "calendar_event",
      entityId: event.id,
      detail: `Termin "${event.title}" angelegt`,
    });

    return this.toEvent(event);
  }

  async removeEvent(user: RequestUser, id: string): Promise<void> {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException("Termin nicht gefunden");
    }
    if (event.organizerId !== user.id && !can(user, "calendar.manage")) {
      throw new ForbiddenException("Nur die organisierende Person kann diesen Termin löschen.");
    }

    await this.prisma.calendarEvent.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: "calendar.delete",
      entityType: "calendar_event",
      entityId: id,
      detail: `Termin "${event.title}" gelöscht`,
    });
  }

  /* ------------------------------------------------------------ Räume */

  async rooms(filter: { from?: string; to?: string } = {}) {
    const from = filter.from ? new Date(filter.from) : new Date();
    const to = filter.to ? new Date(filter.to) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

    const [rooms, bookings] = await Promise.all([
      this.prisma.room.findMany({
        where: { isActive: true },
        include: { location: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      this.prisma.roomBooking.findMany({
        where: { startsAt: { gte: from }, endsAt: { lte: to } },
        include: roomBookingInclude,
        orderBy: { startsAt: "asc" },
      }),
    ]);

    return {
      rooms: rooms.map((room): Room => ({
        id: room.id,
        name: room.name,
        location: room.location?.name ?? "Ohne Standort",
        capacity: room.capacity,
        equipment: room.equipment,
        isActive: room.isActive,
      })),
      bookings: bookings.map((booking) => this.toRoomBooking(booking)),
    };
  }

  async bookRoom(
    user: RequestUser,
    input: { roomId: string; title: string; startsAt: string; endsAt: string },
  ): Promise<RoomBooking> {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException("Das Ende muss nach dem Beginn liegen.");
    }
    if (startsAt < new Date(Date.now() - 60_000)) {
      throw new BadRequestException("Buchungen in der Vergangenheit sind nicht möglich.");
    }

    // Die Kennung eines Raums ist über alle Häuser eindeutig, der Fremdschlüssel
    // nimmt sie also auch aus einem fremden Haus an. Erst dieser Blick über den
    // gefilterten Zugriff stellt sicher, dass der Raum zum eigenen Haus gehört -
    // ohne ihn ließe sich eine Buchung in ein fremdes Haus legen.
    const room = await this.prisma.room.findFirst({
      where: { id: input.roomId, isActive: true },
      select: { id: true },
    });
    if (!room) {
      throw new NotFoundException("Raum nicht gefunden");
    }

    await this.assertFree(input.roomId, startsAt, endsAt);

    const booking = await this.prisma.roomBooking.create({
      data: { roomId: input.roomId, userId: user.id, title: input.title, startsAt, endsAt },
      include: roomBookingInclude,
    });

    await this.audit.log({
      actor: user,
      action: "room.book",
      entityType: "room_booking",
      entityId: booking.id,
      detail: `${booking.room.name} gebucht: ${input.title}`,
    });

    return this.toRoomBooking(booking);
  }

  async cancelRoomBooking(user: RequestUser, id: string): Promise<void> {
    const booking = await this.prisma.roomBooking.findUnique({ where: { id } });
    if (!booking) {
      throw new NotFoundException("Buchung nicht gefunden");
    }
    if (booking.userId !== user.id && !can(user, "calendar.manage")) {
      throw new ForbiddenException("Nur die buchende Person kann stornieren.");
    }
    await this.prisma.roomBooking.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: "room.cancel",
      entityType: "room_booking",
      entityId: id,
      detail: `Raumbuchung "${booking.title}" storniert`,
    });
  }

  /* --------------------------------------------------------- Fuhrpark */

  /** Doppelbelegung eines Raums verhindern. */
  private async assertFree(roomId: string, startsAt: Date, endsAt: Date): Promise<void> {
    const conflict = await this.prisma.roomBooking.findFirst({
      where: { roomId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    });

    if (conflict) {
      throw new BadRequestException("Für diesen Zeitraum liegt bereits eine Buchung vor.");
    }
  }
  private toEvent(event: Prisma.CalendarEventGetPayload<{ include: typeof eventInclude }>): CalendarEvent {
    return {
      id: event.id,
      title: event.title,
      category: event.category,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      location: event.location,
      description: event.description,
      audienceScopes: event.audienceScopes,
      organizer: displayName(event.organizer),
    };
  }

  private toRoomBooking(booking: Prisma.RoomBookingGetPayload<{ include: typeof roomBookingInclude }>): RoomBooking {
    return {
      id: booking.id,
      roomId: booking.roomId,
      roomName: booking.room.name,
      title: booking.title,
      organizer: displayName(booking.user),
      organizerUsername: booking.user.username,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
    };
  }
}
