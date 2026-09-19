import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type { CustodyKind } from "@ah-intranet/shared";
import { ShiftsService } from "./shifts.service";
import { CustodyService } from "./custody.service";
import { MealsService } from "./meals.service";
import { CurrentUser, Feature, Permission } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

/* ------------------------------------------------------------------- DTOs */

class ShiftDto {
  @IsString() @MinLength(2) label!: string;
  @IsString() startsAt!: string;
  @IsString() endsAt!: string;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsString() note?: string;
}

class ShiftPatchDto {
  @IsOptional() @IsString() @MinLength(2) label?: string;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsString() note?: string;
}

class SwapRequestDto {
  @IsString() shiftId!: string;
  @IsString() targetId!: string;
  @IsOptional() @IsString() note?: string;
}

class SwapResponseDto {
  @IsBoolean() accept!: boolean;
}

class SwapDecisionDto {
  @IsBoolean() approve!: boolean;
  @IsOptional() @IsString() note?: string;
}

class CustodyDto {
  @IsIn(["fundsache", "schluessel"]) kind!: CustodyKind;
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() storagePlace?: string;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() foundAt?: string;
  @IsOptional() @IsString() foundPlace?: string;
}

class HandOutDto {
  @IsOptional() @IsString() personId?: string;
  @IsOptional() @IsString() personName?: string;
  @IsOptional() @IsString() note?: string;
}

class NoteDto {
  @IsOptional() @IsString() note?: string;
}

class MealOptionDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() @Min(0) @Max(100_000) priceCents!: number;
}

class MealOfferDto {
  @IsString() date!: string;
  @IsString() @MinLength(2) provider!: string;
  @IsString() orderDeadline!: string;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() note?: string;
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => MealOptionDto) options!: MealOptionDto[];
}

class MealOrderDto {
  @IsString() optionId!: string;
  @IsOptional() @IsInt() @Min(1) @Max(10) quantity?: number;
  @IsOptional() @IsString() note?: string;
}

/* ------------------------------------------------------------ Controller */

@Controller("schichtplan")
@Feature("shifts")
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("mine") mine?: string,
  ) {
    return this.shifts.list(user, { from, to, mine: mine === "true" });
  }

  @Post()
  @Permission("shifts.manage")
  create(@CurrentUser() user: RequestUser, @Body() dto: ShiftDto) {
    return this.shifts.create(user, dto);
  }

  @Patch(":id")
  @Permission("shifts.manage")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: ShiftPatchDto) {
    return this.shifts.update(user, id, dto);
  }

  @Delete(":id")
  @Permission("shifts.manage")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.shifts.remove(user, id);
  }
}

@Controller("diensttausch")
@Feature("shifts")
export class ShiftSwapsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("offen") offen?: string) {
    return this.shifts.swaps(user, { offen: offen === "true" });
  }

  // Kein Recht: abgeben darf, wer eingeteilt ist. Das prüft der Dienst.
  @Post()
  request(@CurrentUser() user: RequestUser, @Body() dto: SwapRequestDto) {
    return this.shifts.requestSwap(user, dto.shiftId, dto.targetId, dto.note);
  }

  @Post(":id/antwort")
  respond(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: SwapResponseDto) {
    return this.shifts.respond(user, id, dto.accept);
  }

  @Post(":id/freigabe")
  @Permission("shifts.approve")
  decide(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: SwapDecisionDto) {
    return this.shifts.decide(user, id, dto.approve, dto.note);
  }

  @Post(":id/zurueckziehen")
  withdraw(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.shifts.withdraw(user, id);
  }
}

@Controller("verwahrung")
@Feature("custody")
export class CustodyController {
  constructor(private readonly custody: CustodyService) {}

  // Lesen darf jedes Konto: wer sein Handy sucht, soll nachsehen können.
  @Get()
  list(@Query("kind") kind?: string, @Query("status") status?: string, @Query("search") search?: string) {
    return this.custody.list({ kind, status, search });
  }

  @Post()
  @Permission("custody.manage")
  create(@CurrentUser() user: RequestUser, @Body() dto: CustodyDto) {
    return this.custody.create(user, dto);
  }

  @Post(":id/ausgabe")
  @Permission("custody.manage")
  handOut(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: HandOutDto) {
    return this.custody.handOut(user, id, dto);
  }

  @Post(":id/ruecknahme")
  @Permission("custody.manage")
  takeBack(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: NoteDto) {
    return this.custody.takeBack(user, id, dto.note);
  }

  @Post(":id/entsorgung")
  @Permission("custody.manage")
  discard(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: NoteDto) {
    return this.custody.discard(user, id, dto.note);
  }
}

@Controller("essen")
@Feature("meals")
export class MealsController {
  constructor(private readonly meals: MealsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("from") from?: string) {
    return this.meals.list(user, { from });
  }

  @Post("angebote")
  @Permission("meals.manage")
  createOffer(@CurrentUser() user: RequestUser, @Body() dto: MealOfferDto) {
    return this.meals.createOffer(user, dto);
  }

  @Delete("angebote/:id")
  @Permission("meals.manage")
  removeOffer(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.meals.removeOffer(user, id);
  }

  @Get("angebote/:id/sammelliste")
  @Permission("meals.manage")
  roundup(@Param("id") id: string) {
    return this.meals.roundup(id);
  }

  @Post("angebote/:id/bestellung")
  order(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: MealOrderDto) {
    return this.meals.order(user, id, dto);
  }

  @Delete("angebote/:id/bestellung")
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.meals.cancel(user, id);
  }
}
