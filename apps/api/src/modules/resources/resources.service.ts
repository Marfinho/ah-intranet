import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type BookingStatus, type CalendarCategory, type VehicleCategory } from "@prisma/client";
import type { CalendarEvent, Room, RoomBooking, Vehicle, VehicleBooking } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { audienceFilter, displayName } from "../../core/mappers";
import { isManaging, type RequestUser } from "../../core/request-user";

const eventInclude = { organizer: { select: { firstName: true, lastName: true } } } as const;
const roomBookingInclude = {
  room: { select: { name: true } },
  user: { select: { username: true, firstName: true, lastName: true } },
} as const;
const vehicleBookingInclude = {
  vehicle: { select: { label: true, plate: true } },
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
        ...(isManaging(user) ? {} : audienceFilter(user)),
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
    if (event.organizerId !== user.id && !isManaging(user)) {
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
      rooms: rooms.map(
        (room): Room => ({
          id: room.id,
          name: room.name,
          location: room.location?.name ?? "Ohne Standort",
          capacity: room.capacity,
          equipment: room.equipment,
          isActive: room.isActive,
        }),
      ),
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

    await this.assertFree("roomBooking", input.roomId, startsAt, endsAt);

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
    if (booking.userId !== user.id && !isManaging(user)) {
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

  async vehicles(filter: { category?: string } = {}) {
    const [vehicles, bookings] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: {
          isActive: true,
          ...(filter.category && filter.category !== "all" ? { category: filter.category as VehicleCategory } : {}),
        },
        include: { location: { select: { name: true } } },
        orderBy: [{ category: "asc" }, { label: "asc" }],
      }),
      this.prisma.vehicleBooking.findMany({
        where: { endsAt: { gte: new Date() }, status: { not: "storniert" } },
        include: vehicleBookingInclude,
        orderBy: { startsAt: "asc" },
      }),
    ]);

    return {
      vehicles: vehicles.map(
        (vehicle): Vehicle => ({
          id: vehicle.id,
          label: vehicle.label,
          plate: vehicle.plate,
          category: vehicle.category,
          location: vehicle.location?.name ?? null,
          isActive: vehicle.isActive,
        }),
      ),
      bookings: bookings.map((booking) => this.toVehicleBooking(booking)),
    };
  }

  async bookVehicle(
    user: RequestUser,
    input: { vehicleId: string; purpose: string; startsAt: string; endsAt: string },
  ): Promise<VehicleBooking> {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException("Das Ende muss nach dem Beginn liegen.");
    }

    await this.assertFree("vehicleBooking", input.vehicleId, startsAt, endsAt);

    const booking = await this.prisma.vehicleBooking.create({
      data: { vehicleId: input.vehicleId, userId: user.id, purpose: input.purpose, startsAt, endsAt },
      include: vehicleBookingInclude,
    });

    await this.audit.log({
      actor: user,
      action: "vehicle.book",
      entityType: "vehicle_booking",
      entityId: booking.id,
      detail: `${booking.vehicle.label} (${booking.vehicle.plate}) reserviert: ${input.purpose}`,
    });

    return this.toVehicleBooking(booking);
  }

  async setVehicleBookingStatus(user: RequestUser, id: string, status: BookingStatus): Promise<VehicleBooking> {
    const booking = await this.prisma.vehicleBooking.findUnique({ where: { id } });
    if (!booking) {
      throw new NotFoundException("Reservierung nicht gefunden");
    }
    if (booking.userId !== user.id && !isManaging(user)) {
      throw new ForbiddenException("Diese Reservierung gehört zu einer anderen Person.");
    }

    const updated = await this.prisma.vehicleBooking.update({
      where: { id },
      data: { status },
      include: vehicleBookingInclude,
    });

    await this.audit.log({
      actor: user,
      action: "vehicle.status",
      entityType: "vehicle_booking",
      entityId: id,
      detail: `Reservierung ${updated.vehicle.plate}: ${status}`,
    });

    return this.toVehicleBooking(updated);
  }

  /**
   * Doppelbelegungen abweisen. Zwei Zeiträume überschneiden sich genau dann,
   * wenn der eine beginnt, bevor der andere endet - und umgekehrt.
   */
  private async assertFree(
    table: "roomBooking" | "vehicleBooking",
    resourceId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<void> {
    const where =
      table === "roomBooking"
        ? { roomId: resourceId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }
        : {
            vehicleId: resourceId,
            status: { not: "storniert" as BookingStatus },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          };

    const conflict =
      table === "roomBooking"
        ? await this.prisma.roomBooking.findFirst({ where: where as Prisma.RoomBookingWhereInput })
        : await this.prisma.vehicleBooking.findFirst({ where: where as Prisma.VehicleBookingWhereInput });

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

  private toRoomBooking(
    booking: Prisma.RoomBookingGetPayload<{ include: typeof roomBookingInclude }>,
  ): RoomBooking {
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

  private toVehicleBooking(
    booking: Prisma.VehicleBookingGetPayload<{ include: typeof vehicleBookingInclude }>,
  ): VehicleBooking {
    return {
      id: booking.id,
      vehicleId: booking.vehicleId,
      vehicleLabel: booking.vehicle.label,
      plate: booking.vehicle.plate,
      purpose: booking.purpose,
      driver: displayName(booking.user),
      driverUsername: booking.user.username,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      status: booking.status,
    };
  }
}
