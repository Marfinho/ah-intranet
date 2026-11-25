import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
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
import { HAEUSER_MAX, LEAD_STATUS, NUTZER_MAX } from "@ah-intranet/shared";
import { Aktuell, Schreibend, type Sitzung } from "../../core/decorators";
import { LINK_TAGE_MAX } from "../../core/pitch-link";
import { InteressentenService } from "./interessenten.service";

class StatusDto {
  @IsIn([...LEAD_STATUS]) status!: string;
}
class NotizDto {
  @IsOptional() @IsString() notiz?: string | null;
}
class KonfigurationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(HAEUSER_MAX) haeuser?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(NUTZER_MAX) nutzer?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(NUTZER_MAX) keyUser?: number | null;
  @IsOptional() @IsString() tier?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) module?: string[];
}
class AnlegenDto {
  @IsString() @IsNotEmpty({ message: "Name des Interessenten ist erforderlich" }) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(160) ansprechperson?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) notiz?: string | null;
  /** Häuser als Textzeilen: Name | Straße | PLZ Ort | Marken | Leistungen | Öffnungszeiten | Verbund | Text. */
  @IsString() @IsNotEmpty({ message: "Bitte mindestens ein Haus angeben" }) @MaxLength(20000) standorteText!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(LINK_TAGE_MAX) linkTage?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(NUTZER_MAX) nutzer?: number;
  @IsOptional() @IsString() tier?: string | null;
}
class AendernDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(160) ansprechperson?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) notiz?: string | null;
  @IsOptional() @IsString() @MaxLength(20000) standorteText?: string;
  @IsOptional() @ValidateNested() @Type(() => KonfigurationDto) konfiguration?: KonfigurationDto;
}
class LinkDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(LINK_TAGE_MAX) linkTage?: number;
}
class HausAnlegenDto {
  @IsString() @IsNotEmpty({ message: "Kennung ist erforderlich" }) slug!: string;
  @IsOptional() @IsString() domain?: string;
  @IsString() @IsNotEmpty({ message: "Benutzername des ersten Kontos ist erforderlich" }) adminUsername!: string;
  @IsString()
  @MinLength(10, { message: "Das Startpasswort muss mindestens 10 Zeichen lang sein" })
  adminPassword!: string;
  @IsOptional() @IsString() adminFirstName?: string;
  @IsOptional() @IsString() adminLastName?: string;
  @IsOptional() @IsEmail({}, { message: "Bitte eine gültige E-Mail-Adresse angeben" }) adminEmail?: string;
}

@Controller("interessenten")
export class InteressentenController {
  constructor(private readonly interessenten: InteressentenService) {}

  @Get() async liste() {
    const [liste, auswertung] = await Promise.all([this.interessenten.liste(), this.interessenten.auswertung()]);
    return { liste, auswertung };
  }
  @Get(":id") detail(@Param("id") id: string) {
    return this.interessenten.detail(id);
  }
  @Get(":id/haus") hausVorschau(@Param("id") id: string) {
    return this.interessenten.hausVorschau(id);
  }

  @Post()
  @Schreibend()
  anlegen(@Aktuell() wer: Sitzung, @Body() dto: AnlegenDto) {
    return this.interessenten.anlegen(wer, dto);
  }

  @Put(":id")
  @Schreibend()
  async aendern(@Aktuell() wer: Sitzung, @Param("id") id: string, @Body() dto: AendernDto) {
    await this.interessenten.aendern(wer, id, dto);
    return { ok: true };
  }

  @Post(":id/link")
  @Schreibend()
  @HttpCode(200)
  link(@Aktuell() wer: Sitzung, @Param("id") id: string, @Body() dto: LinkDto) {
    return this.interessenten.neuerLink(wer, id, dto.linkTage);
  }

  @Post(":id/haus")
  @Schreibend()
  hausAnlegen(@Aktuell() wer: Sitzung, @Param("id") id: string, @Body() dto: HausAnlegenDto) {
    return this.interessenten.hausAnlegen(wer, id, dto);
  }

  @Patch(":id/status")
  @Schreibend()
  async status(@Aktuell() wer: Sitzung, @Param("id") id: string, @Body() dto: StatusDto) {
    await this.interessenten.setzeStatus(wer, id, dto.status);
    return { ok: true };
  }
  @Patch(":id/notiz")
  @Schreibend()
  async notiz(@Aktuell() wer: Sitzung, @Param("id") id: string, @Body() dto: NotizDto) {
    await this.interessenten.setzeNotiz(wer, id, dto.notiz ?? null);
    return { ok: true };
  }
  @Post(":id/link-widerrufen")
  @Schreibend()
  @HttpCode(200)
  async widerrufen(@Aktuell() wer: Sitzung, @Param("id") id: string) {
    await this.interessenten.widerrufeLink(wer, id);
    return { ok: true };
  }
  @Delete(":id")
  @Schreibend()
  @HttpCode(204)
  async loeschen(@Aktuell() wer: Sitzung, @Param("id") id: string) {
    await this.interessenten.loeschen(wer, id);
  }
}
