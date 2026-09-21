import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { Priority, TicketStatus } from "@prisma/client";
import { PlatformSupportService } from "./platform-support.service";
import { CurrentUser, PlatformPermission } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

class PlatformSupportMessageDto {
  @IsString() @MinLength(2) body!: string;
  @IsOptional() @IsBoolean() isInternal?: boolean;
}

class PlatformSupportPatchDto {
  @IsOptional() @IsIn(["offen", "in_bearbeitung", "wartet_auf_rueckmeldung", "geloest"]) status?: TicketStatus;
  @IsOptional() @IsIn(["niedrig", "normal", "hoch", "kritisch"]) priority?: Priority;
  @IsOptional() @IsString() assigneeId?: string | null;
}

/**
 * Support-Posteingang der Plattformverwaltung: Anfragen aller Häuser.
 *
 * Getrennt von `SupportTicketsController`, das nur das eigene Haus sieht -
 * derselbe Endpunkt für beide Blicke hätte den Mandantenfilter fallweise
 * umgehen müssen, statt ihn strukturell zu erzwingen.
 */
@Controller("plattform/support-tickets")
export class PlatformSupportController {
  constructor(private readonly support: PlatformSupportService) {}

  @Get()
  @PlatformPermission("support.tickets.view")
  list(@Query("status") status?: string, @Query("search") search?: string) {
    return this.support.list({ status, search });
  }

  @Get(":id")
  @PlatformPermission("support.tickets.view")
  detail(@Param("id") id: string) {
    return this.support.detail(id);
  }

  @Post(":id/nachrichten")
  @PlatformPermission("support.tickets.manage")
  addMessage(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: PlatformSupportMessageDto) {
    return this.support.addMessage(user, id, { body: dto.body, isInternal: dto.isInternal ?? false });
  }

  @Patch(":id")
  @PlatformPermission("support.tickets.manage")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: PlatformSupportPatchDto) {
    return this.support.update(user, id, dto);
  }
}
