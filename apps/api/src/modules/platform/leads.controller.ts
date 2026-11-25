import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { HAEUSER_MAX, KUNDEN_HAEUSER_MAX, LEAD_STATUS, NUTZER_MAX, type LeadStatusKey } from "@ah-intranet/shared";
import { CurrentUser, Public } from "../../core/decorators";
import { PlatformAdmin } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";
import { LeadsService } from "./leads.service";
import { LINK_TAGE_MAX } from "./pitch-regeln";

class StandortDto {
  @IsString()
  @IsNotEmpty({ message: "Jedes Haus braucht einen Namen" })
  @MaxLength(120)
  name!: string;

  @IsOptional() @IsString() @MaxLength(160) strasse?: string | null;
  @IsOptional() @IsString() @MaxLength(10) plz?: string | null;
  @IsOptional() @IsString() @MaxLength(80) ort?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  marken?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  leistungen?: string[];

  @IsOptional() @IsString() @MaxLength(200) oeffnungszeiten?: string | null;
  @IsOptional() @IsString() @MaxLength(80) campus?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) vorschlag?: string | null;
}

/** Ein Haus, wie der Interessent es auf der Pitch-Seite verändert. */
class PitchHausDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional() @IsString() @MaxLength(240) adresse!: string | null;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  marken!: string[];

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  leistungen!: string[];

  @IsOptional() @IsString() @MaxLength(200) oeffnungszeiten!: string | null;
  @IsOptional() @IsString() @MaxLength(80) campus!: string | null;
}

class KonfigurationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(HAEUSER_MAX) haeuser?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(NUTZER_MAX) nutzer?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(NUTZER_MAX) keyUser?: number | null;
  @IsOptional() @IsString() tier?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  module?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(KUNDEN_HAEUSER_MAX)
  @ValidateNested({ each: true })
  @Type(() => PitchHausDto)
  standorte?: PitchHausDto[];
}

class CreateLeadDto {
  @IsString()
  @IsNotEmpty({ message: "Name des Interessenten ist erforderlich" })
  @MaxLength(160)
  name!: string;

  @IsOptional() @IsString() @MaxLength(160) ansprechperson?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) notiz?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(LINK_TAGE_MAX) linkTage?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(NUTZER_MAX) nutzer?: number;
  @IsOptional() @IsString() tier?: string | null;

  @IsArray()
  @ArrayMaxSize(KUNDEN_HAEUSER_MAX)
  @ValidateNested({ each: true })
  @Type(() => StandortDto)
  standorte!: StandortDto[];
}

class UpdateLeadDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(160) ansprechperson?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) notiz?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(KUNDEN_HAEUSER_MAX)
  @ValidateNested({ each: true })
  @Type(() => StandortDto)
  standorte?: StandortDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => KonfigurationDto)
  konfiguration?: KonfigurationDto;
}

class StatusDto {
  @IsIn([...LEAD_STATUS])
  status!: LeadStatusKey;
}

class HausAnlegenDto {
  @IsString()
  @IsNotEmpty({ message: "Kennung ist erforderlich" })
  slug!: string;

  @IsOptional() @IsString() domain?: string;

  @IsString()
  @IsNotEmpty({ message: "Benutzername des ersten Kontos ist erforderlich" })
  adminUsername!: string;

  @IsString()
  @MinLength(10, { message: "Das Startpasswort muss mindestens 10 Zeichen lang sein" })
  adminPassword!: string;

  @IsOptional() @IsString() adminFirstName?: string;
  @IsOptional() @IsString() adminLastName?: string;
  @IsOptional() @IsEmail({}, { message: "Bitte eine gültige E-Mail-Adresse angeben" }) adminEmail?: string;
}

class LinkDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(LINK_TAGE_MAX) linkTage?: number;
}

/**
 * Interessenten-Verwaltung der Plattform.
 *
 * Nur für die Plattformverwaltung: ein Interessent ist kein Haus und hat im
 * Intranet eines Kunden nichts zu suchen.
 */
@Controller("leads")
@PlatformAdmin()
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list() {
    return this.leads.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.leads.get(id);
  }

  @Post()
  create(@Body() dto: CreateLeadDto, @CurrentUser() user: RequestUser) {
    return this.leads.create(user, dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateLeadDto, @CurrentUser() user: RequestUser) {
    return this.leads.update(user, id, dto);
  }

  @Patch(":id/status")
  setStatus(@Param("id") id: string, @Body() dto: StatusDto, @CurrentUser() user: RequestUser) {
    return this.leads.setStatus(user, id, dto.status);
  }

  @Post(":id/link")
  neuerLink(@Param("id") id: string, @Body() dto: LinkDto, @CurrentUser() user: RequestUser) {
    return this.leads.neuerLink(user, id, dto.linkTage);
  }

  @Get(":id/haus")
  hausVorschau(@Param("id") id: string) {
    return this.leads.hausVorschau(id);
  }

  @Post(":id/haus")
  hausAnlegen(@Param("id") id: string, @Body() dto: HausAnlegenDto, @CurrentUser() user: RequestUser) {
    return this.leads.hausAnlegen(user, id, dto);
  }

  @Post(":id/widerrufen")
  widerrufen(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.leads.widerrufen(user, id);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    await this.leads.remove(user, id);
  }
}

/**
 * Die Pitch-Seite eines Interessenten, ohne Anmeldung.
 *
 * Das Token im Pfad ist die einzige Berechtigung. Drosselung je Adresse, damit
 * sich Links nicht durchprobieren lassen: bei 256 Bit Zufall ist Raten
 * aussichtslos, aber ein Zugang ohne Anmeldung gehört trotzdem begrenzt.
 */
@Controller("angebot")
export class PitchController {
  constructor(private readonly leads: LeadsService) {}

  @Get(":token")
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  ansicht(@Param("token") token: string) {
    return this.leads.ansicht(token);
  }

  @Put(":token")
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  speichern(@Param("token") token: string, @Body() dto: KonfigurationDto) {
    return this.leads.speichern(token, dto);
  }

  @Post(":token/anfrage")
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  anfragen(@Param("token") token: string, @Body() dto: KonfigurationDto) {
    return this.leads.anfragen(token, dto);
  }
}
