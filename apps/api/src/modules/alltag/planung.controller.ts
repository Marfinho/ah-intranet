import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";
import { PlanungService } from "./planung.service";
import { SchichtartenService } from "./schichtarten.service";
import { CurrentUser, Feature, Permission } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

const UHRZEIT = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

class SchichtartDto {
  @IsString() name!: string;
  @Matches(UHRZEIT, { message: "Beginn als Uhrzeit angeben (HH:MM)" }) startZeit!: string;
  @Matches(UHRZEIT, { message: "Ende als Uhrzeit angeben (HH:MM)" }) endZeit!: string;
  @IsOptional() @IsInt() @Min(0) @Max(240) pauseMinuten?: number;
  // Pflichtfelder: eine Schichtart ohne Soll-Besetzung ließe sich nicht planen.
  @IsInt() @Min(1) @Max(99) mindestBesetzung!: number;
  @IsInt() @Min(1) @Max(99) idealBesetzung!: number;
  @IsArray() @ArrayNotEmpty() @IsInt({ each: true }) @Min(1, { each: true }) @Max(7, { each: true }) tage!: number[];
  @IsOptional() @IsBoolean() beiSondertag?: boolean;
  @IsOptional() @IsBoolean() aktiv?: boolean;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() teamLeadId?: string;
}

class ProfilDto {
  @IsOptional() @IsNumber() @Min(0) @Max(60) wochenstunden?: number | null;
  @IsOptional() @Matches(UHRZEIT) zeitfensterVon?: string | null;
  @IsOptional() @Matches(UHRZEIT) zeitfensterBis?: string | null;
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  arbeitstage?: number[];
}

class PlanDto {
  @Matches(DATUM) von!: string;
  @Matches(DATUM) bis!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) schichtartIds?: string[];
}

@Controller("schichtplanung")
@Feature("shifts")
export class PlanungController {
  constructor(
    private readonly arten: SchichtartenService,
    private readonly planung: PlanungService,
  ) {}

  /* Schichtarten */

  @Get("arten")
  @Permission("shifts.manage")
  listArten() {
    return this.arten.list();
  }

  @Post("arten")
  @Permission("shifts.manage")
  createArt(@CurrentUser() user: RequestUser, @Body() dto: SchichtartDto) {
    return this.arten.create(user, dto);
  }

  @Put("arten/:id")
  @Permission("shifts.manage")
  updateArt(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: SchichtartDto) {
    return this.arten.update(user, id, dto);
  }

  @Delete("arten/:id")
  @HttpCode(200)
  @Permission("shifts.manage")
  removeArt(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.arten.remove(user, id);
  }

  /* Arbeitszeitprofile */

  @Get("personal")
  @Permission("shifts.manage")
  profile() {
    return this.arten.profile();
  }

  @Patch("personal/:id")
  @Permission("shifts.manage")
  setzeProfil(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: ProfilDto) {
    return this.arten.setzeProfil(user, id, dto);
  }

  /* Planung */

  /** Rechnet nur - schreibt nichts. `arten` ist eine kommagetrennte Liste von Schichtart-Kennungen. */
  @Get("vorschau")
  @Permission("shifts.manage")
  vorschau(@Query("von") von: string, @Query("bis") bis: string, @Query("arten") arten?: string) {
    return this.planung.vorschau({ von, bis, schichtartIds: arten ? arten.split(",").filter(Boolean) : undefined });
  }

  @Post("uebernehmen")
  @HttpCode(200)
  @Permission("shifts.manage")
  uebernehmen(@CurrentUser() user: RequestUser, @Body() dto: PlanDto) {
    return this.planung.uebernehmen(user, dto);
  }

  /** Ohne Recht: wer den Plan nicht pflegt, bekommt nur die eigenen Befunde. Das entscheidet der Dienst. */
  @Get("pruefung")
  pruefung(@CurrentUser() user: RequestUser, @Query("von") von: string, @Query("bis") bis: string) {
    return this.planung.pruefung(user, von, bis);
  }
}
