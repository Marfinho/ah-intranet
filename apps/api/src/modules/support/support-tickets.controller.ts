import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { IsIn, IsString, MinLength } from "class-validator";
import type { Priority } from "@prisma/client";
import { SupportTicketsService } from "./support-tickets.service";
import { CurrentUser } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

class SupportTicketDto {
  @IsString() @MinLength(3) subject!: string;
  @IsString() @MinLength(5) description!: string;
  @IsIn(["niedrig", "normal", "hoch", "kritisch"]) priority!: Priority;
}

class SupportMessageDto {
  @IsString() @MinLength(2) body!: string;
}

/**
 * Support-Anfragen des eigenen Hauses an den Betreiber.
 *
 * Bewusst kein abschaltbares Fachmodul: der Kanal zum Betreiber gehört zur
 * Kundenbeziehung, nicht zum Betriebsalltag im Haus. Offen für jedes
 * angemeldete Konto, weil ein Softwareproblem nicht immer bei der Person
 * auffällt, die auch die Verwaltung bedient.
 */
@Controller("support/tickets")
export class SupportTicketsController {
  constructor(private readonly support: SupportTicketsService) {}

  @Get()
  list() {
    return this.support.list();
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.support.detail(id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: SupportTicketDto) {
    return this.support.create(user, dto);
  }

  @Post(":id/nachrichten")
  addMessage(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: SupportMessageDto) {
    return this.support.addMessage(user, id, dto.body);
  }
}
