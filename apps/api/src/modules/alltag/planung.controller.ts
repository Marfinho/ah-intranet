import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import type { PlanEntwurfItem } from "@ah-intranet/shared";
import { EntwurfService } from "./entwurf.service";
import { PlanungService } from "./planung.service";
import { SchichtartenService } from "./schichtarten.service";
import { CurrentUser, Feature, Permission } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

/** Fehlende optionale Felder werden zu `null`: im Entwurf heißt „nicht gesetzt" immer null, nie undefined. */
function alsItems(dtos: EntwurfItemDto[]): PlanEntwurfItem[] {
  return dtos.map((dto) => ({
    ...dto,
    liveId: dto.liveId ?? null,
    liveStand: dto.liveStand ?? null,
    assigneeId: dto.assigneeId ?? null,
    schichtartId: dto.schichtartId ?? null,
    locationId: dto.locationId ?? null,
    departmentId: dto.departmentId ?? null,
    note: dto.note ?? null,
  }));
}

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

class EntwurfItemDto {
  @IsString() @MaxLength(64) key!: string;
  @IsOptional() @IsString() liveId?: string | null;
  @IsOptional() @IsString() liveStand?: string | null;
  @IsString() label!: string;
  @IsString() startsAt!: string;
  @IsString() endsAt!: string;
  @IsInt() @Min(0) @Max(240) pauseMinuten!: number;
  @IsOptional() @IsString() assigneeId?: string | null;
  @IsOptional() @IsString() schichtartId?: string | null;
  @IsOptional() @IsString() locationId?: string | null;
  @IsOptional() @IsString() departmentId?: string | null;
  @IsOptional() @IsString() note?: string | null;
  @IsOptional() @IsBoolean() geloescht?: boolean;
}

class EntwurfNeuDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @Matches(DATUM) von!: string;
  @Matches(DATUM) bis!: string;
  @IsIn(["leer", "bestand"]) basis!: "leer" | "bestand";
}

class EntwurfSpeichernDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => EntwurfItemDto) items!: EntwurfItemDto[];
}

class VorschlagDto {
  @Matches(DATUM) von!: string;
  @Matches(DATUM) bis!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) schichtartIds?: string[];
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => EntwurfItemDto) items!: EntwurfItemDto[];
}

class VersionDto {
  @IsInt() @Min(1) version!: number;
}

@Controller("schichtplanung")
@Feature("shifts")
export class PlanungController {
  constructor(
    private readonly arten: SchichtartenService,
    private readonly planung: PlanungService,
    private readonly entwurf: EntwurfService,
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

  /* Entwürfe: die einzige Art, den Plan zu ändern - mit Autoplanung, ohne sofortige Meldung */

  @Get("entwuerfe")
  @Permission("shifts.manage")
  entwuerfe(@Query("von") von: string, @Query("bis") bis: string) {
    return this.entwurf.liste(von, bis);
  }

  @Post("entwuerfe")
  @Permission("shifts.manage")
  neuerEntwurf(@CurrentUser() user: RequestUser, @Body() dto: EntwurfNeuDto) {
    return this.entwurf.erstelle(user, dto);
  }

  /** Rechnet die Autoplanung für den übergebenen Entwurfsstand - speichert nichts. */
  @Post("entwuerfe/vorschlag")
  @HttpCode(200)
  @Permission("shifts.manage")
  vorschlag(@Body() dto: VorschlagDto) {
    return this.entwurf.vorschlag({ ...dto, items: alsItems(dto.items) });
  }

  @Get("entwuerfe/:id")
  @Permission("shifts.manage")
  entwurfLaden(@Param("id") id: string) {
    return this.entwurf.lade(id);
  }

  @Put("entwuerfe/:id")
  @Permission("shifts.manage")
  entwurfSpeichern(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: EntwurfSpeichernDto) {
    return this.entwurf.speichere(user, id, { ...dto, items: alsItems(dto.items) });
  }

  @Delete("entwuerfe/:id")
  @HttpCode(200)
  @Permission("shifts.manage")
  entwurfVerwerfen(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.entwurf.loesche(user, id);
  }

  /** „Plan speichern": wendet den Entwurf an und meldet - das ist der einzige Weg zu einer Meldung. */
  @Post("entwuerfe/:id/veroeffentlichen")
  @HttpCode(200)
  @Permission("shifts.manage")
  veroeffentlichen(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: VersionDto) {
    return this.entwurf.veroeffentliche(user, id, dto.version);
  }

  /** Ohne Recht: wer den Plan nicht pflegt, bekommt nur die eigenen Befunde. Das entscheidet der Dienst. */
  @Get("pruefung")
  pruefung(@CurrentUser() user: RequestUser, @Query("von") von: string, @Query("bis") bis: string) {
    return this.planung.pruefung(user, von, bis);
  }
}
