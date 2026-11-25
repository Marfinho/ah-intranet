import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { BETRIEBSTAG_ARTEN, type BetriebstagArt } from "@ah-intranet/shared";
import { BetriebskalenderService } from "./betriebskalender.service";
import { CurrentUser, Permission } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

const ARTEN = BETRIEBSTAG_ARTEN.map((art) => art.key);

class TagBodyDto {
  @IsString() datum!: string;
  @IsIn(ARTEN) art!: BetriebstagArt;
  @IsString() name!: string;
  @IsOptional() @IsBoolean() arbeitsfrei?: boolean;
  /** Leer = ganzes Haus; sonst ein Eintrag je Standort. */
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) locationIds?: string[];
}

class TagPatchDto {
  @IsOptional() @IsString() datum?: string;
  @IsOptional() @IsIn(ARTEN) art?: BetriebstagArt;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsBoolean() arbeitsfrei?: boolean;
}

class UebertragungDto {
  @IsArray() @ArrayUnique() @IsString({ each: true }) locationIds!: string[];
}

class UebernahmeDto {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) jahr!: number;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsIn(ARTEN, { each: true }) arten?: BetriebstagArt[];
}

function jahrAus(text?: string): number {
  const jahr = Number(text);
  return Number.isInteger(jahr) && jahr >= 2000 && jahr <= 2100 ? jahr : new Date().getFullYear();
}

@Controller("betriebskalender")
export class BetriebskalenderController {
  constructor(private readonly kalender: BetriebskalenderService) {}

  /** Ohne Recht: Anträge und Planung zeigen diese Tage jedem an. */
  @Get("tage")
  tage(@Query("jahr") jahr?: string) {
    return this.kalender.tage(jahrAus(jahr));
  }

  @Get()
  @Permission("organisation.manage")
  ansicht(@Query("jahr") jahr?: string) {
    return this.kalender.ansicht(jahrAus(jahr));
  }

  @Post("uebernehmen")
  @HttpCode(200)
  @Permission("organisation.manage")
  uebernehmen(@CurrentUser() user: RequestUser, @Body() dto: UebernahmeDto) {
    return this.kalender.uebernehmen(user, dto);
  }

  @Post()
  @Permission("organisation.manage")
  create(@CurrentUser() user: RequestUser, @Body() dto: TagBodyDto) {
    return this.kalender.create(user, dto);
  }

  @Post(":id/uebertragen")
  @HttpCode(200)
  @Permission("organisation.manage")
  uebertragen(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UebertragungDto) {
    return this.kalender.uebertragen(user, id, dto.locationIds);
  }

  @Patch(":id")
  @Permission("organisation.manage")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: TagPatchDto) {
    return this.kalender.update(user, id, dto);
  }

  @Delete(":id")
  @Permission("organisation.manage")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.kalender.remove(user, id);
  }
}
