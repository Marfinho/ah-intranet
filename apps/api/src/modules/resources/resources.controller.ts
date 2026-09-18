import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { IsArray, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { BookingStatus, CalendarCategory } from "@prisma/client";
import { ResourcesService } from "./resources.service";
import { CurrentUser, Feature, Roles } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

class EventDto {
  @IsString() @MinLength(3) title!: string;
  @IsIn(["schulung", "aktion", "wartung", "meeting", "bestellung"]) category!: CalendarCategory;
  @IsString() startsAt!: string;
  @IsString() endsAt!: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() description?: string;
  @IsArray() @IsString({ each: true }) audienceScopes!: string[];
}

class RoomBookingDto {
  @IsString() roomId!: string;
  @IsString() @MinLength(3) title!: string;
  @IsString() startsAt!: string;
  @IsString() endsAt!: string;
}

class VehicleBookingDto {
  @IsString() vehicleId!: string;
  @IsString() @MinLength(3) purpose!: string;
  @IsString() startsAt!: string;
  @IsString() endsAt!: string;
}

class BookingStatusDto {
  @IsIn(["reserviert", "abgeholt", "zurueckgegeben", "storniert"]) status!: BookingStatus;
}

@Controller("calendar")
@Feature("calendar")
export class CalendarController {
  constructor(private readonly resources: ResourcesService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("category") category?: string,
  ) {
    return this.resources.events(user, { from, to, category });
  }

  @Post()
  @Roles("admin", "fachbereichsadmin", "fuehrungskraft")
  create(@CurrentUser() user: RequestUser, @Body() dto: EventDto) {
    return this.resources.createEvent(user, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.resources.removeEvent(user, id);
  }
}

@Controller("rooms")
@Feature("rooms")
export class RoomsController {
  constructor(private readonly resources: ResourcesService) {}

  @Get()
  list(@Query("from") from?: string, @Query("to") to?: string) {
    return this.resources.rooms({ from, to });
  }

  @Post("bookings")
  book(@CurrentUser() user: RequestUser, @Body() dto: RoomBookingDto) {
    return this.resources.bookRoom(user, dto);
  }

  @Delete("bookings/:id")
  @HttpCode(204)
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.resources.cancelRoomBooking(user, id);
  }
}

@Controller("vehicles")
@Feature("vehicles")
export class VehiclesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get()
  list(@Query("category") category?: string) {
    return this.resources.vehicles({ category });
  }

  @Post("bookings")
  book(@CurrentUser() user: RequestUser, @Body() dto: VehicleBookingDto) {
    return this.resources.bookVehicle(user, dto);
  }

  @Patch("bookings/:id")
  setStatus(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: BookingStatusDto) {
    return this.resources.setVehicleBookingStatus(user, id, dto.status);
  }
}
