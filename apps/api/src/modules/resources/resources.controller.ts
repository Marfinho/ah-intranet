import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { IsArray, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { CalendarCategory } from "@prisma/client";
import { ResourcesService } from "./resources.service";
import { OutlookCalendarService } from "./outlook-calendar.service";
import { CurrentUser, Feature, Permission } from "../../core/decorators";
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

@Controller("calendar")
@Feature("calendar")
export class CalendarController {
  constructor(
    private readonly resources: ResourcesService,
    private readonly outlook: OutlookCalendarService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("category") category?: string,
  ) {
    return this.resources.events(user, { from, to, category });
  }

  /**
   * Nur für Konten, die sich mindestens einmal über Entra ID angemeldet
   * haben - erst dabei entsteht der Refresh-Token für den Kalenderzugriff.
   */
  @Get("outlook")
  outlookEvents(@CurrentUser() user: RequestUser) {
    return this.outlook.getEvents(user);
  }

  @Post()
  @Permission("calendar.manage")
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
