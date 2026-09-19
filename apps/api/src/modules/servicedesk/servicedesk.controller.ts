import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { IdeaStatus, Priority, TicketCategory, TicketStatus } from "@prisma/client";
import { ServiceDeskService } from "./servicedesk.service";
import { CurrentUser, Feature, Permission, Roles } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

class TicketDto {
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(5) description!: string;
  @IsIn(["it", "facility", "hr", "marketing"]) category!: TicketCategory;
  @IsIn(["niedrig", "normal", "hoch", "kritisch"]) priority!: Priority;
}

class TicketPatchDto {
  @IsOptional() @IsIn(["offen", "in_bearbeitung", "wartet_auf_rueckmeldung", "geloest"]) status?: TicketStatus;
  @IsOptional() @IsIn(["niedrig", "normal", "hoch", "kritisch"]) priority?: Priority;
  @IsOptional() @IsString() assigneeId?: string | null;
}

class MessageDto {
  @IsString() @MinLength(2) message!: string;
}

class IdeaDto {
  @IsString() @MinLength(5) title!: string;
  @IsString() @MinLength(10) description!: string;
  @IsOptional() @IsString() category?: string;
}

class IdeaStatusDto {
  @IsIn(["neu", "in_pruefung", "angenommen", "umgesetzt", "abgelehnt"]) status!: IdeaStatus;
  @IsOptional() @IsString() decisionNote?: string;
}

class PollDto {
  @IsString() @MinLength(5) question!: string;
  @IsOptional() @IsString() description?: string;
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) options!: string[];
  @IsOptional() @IsString() closesAt?: string;
}

class VoteDto {
  @IsString() optionId!: string;
}

@Controller("tickets")
@Feature("tickets")
export class TicketsController {
  constructor(private readonly desk: ServiceDeskService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("scope") scope?: "mine" | "all",
    @Query("status") status?: string,
    @Query("category") category?: string,
    @Query("search") search?: string,
  ) {
    return this.desk.tickets(user, { scope, status, category, search });
  }

  @Get(":id")
  detail(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.desk.ticketDetail(user, id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: TicketDto) {
    return this.desk.createTicket(user, dto);
  }

  @Patch(":id")
  @Roles("admin", "fachbereichsadmin")
  @Permission("tickets.manage")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: TicketPatchDto) {
    return this.desk.updateTicket(user, id, dto);
  }

  @Post(":id/comments")
  comment(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: MessageDto) {
    return this.desk.commentTicket(user, id, dto.message);
  }
}

@Controller("ideas")
@Feature("ideas")
export class IdeasController {
  constructor(private readonly desk: ServiceDeskService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("status") status?: string, @Query("search") search?: string) {
    return this.desk.ideas(user, { status, search });
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: IdeaDto) {
    return this.desk.createIdea(user, { ...dto, category: dto.category ?? "Allgemein" });
  }

  @Post(":id/vote")
  vote(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.desk.toggleVote(user, id);
  }

  @Patch(":id/status")
  @Roles("admin", "fachbereichsadmin")
  setStatus(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: IdeaStatusDto) {
    return this.desk.setIdeaStatus(user, id, dto.status, dto.decisionNote);
  }
}

@Controller("polls")
@Feature("polls")
export class PollsController {
  constructor(private readonly desk: ServiceDeskService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("all") all?: string) {
    return this.desk.polls(user, all === "true");
  }

  @Post()
  @Roles("admin", "fachbereichsadmin")
  create(@CurrentUser() user: RequestUser, @Body() dto: PollDto) {
    return this.desk.createPoll(user, dto);
  }

  @Post(":id/vote")
  vote(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: VoteDto) {
    return this.desk.vote(user, id, dto.optionId);
  }

  @Post(":id/close")
  @Roles("admin", "fachbereichsadmin")
  close(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.desk.closePoll(user, id);
  }
}
