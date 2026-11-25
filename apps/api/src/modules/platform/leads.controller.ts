import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { HAEUSER_MAX, KUNDEN_HAEUSER_MAX, NUTZER_MAX } from "@ah-intranet/shared";
import { Public } from "../../core/decorators";
import { LeadsService } from "./leads.service";

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
