import { Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Aktuell, Schreibend, type Sitzung } from "../../core/decorators";
import { HausAnlegenService } from "./haus-anlegen.service";
import { HaeuserService } from "./haeuser.service";

class AktivDto {
  @IsBoolean() isActive!: boolean;
}
class LizenzDto {
  // Leer heißt unbegrenzt.
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) licensedSeats?: number | null;
}
class StandortlimitDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) locationLimit?: number | null;
}
class NotizDto {
  @IsOptional() @IsString() notes?: string | null;
}
class ModulDto {
  @IsBoolean() enabled!: boolean;
}

class NeuesHausDto {
  @IsString() @IsNotEmpty({ message: "Kennung ist erforderlich" }) slug!: string;
  @IsString() @IsNotEmpty({ message: "Name ist erforderlich" }) @MaxLength(160) name!: string;
  @IsOptional() @IsString() domain?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsString() @IsNotEmpty({ message: "Benutzername des ersten Kontos ist erforderlich" }) adminUsername!: string;
  @IsString()
  @MinLength(10, { message: "Das Startpasswort muss mindestens 10 Zeichen lang sein" })
  adminPassword!: string;
  @IsOptional() @IsString() adminFirstName?: string;
  @IsOptional() @IsString() adminLastName?: string;
  @IsOptional() @IsEmail({}, { message: "Bitte eine gültige E-Mail-Adresse angeben" }) adminEmail?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) licensedSeats?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) locationLimit?: number;
}

@Controller("haeuser")
export class HaeuserController {
  constructor(
    private readonly haeuser: HaeuserService,
    private readonly anlegen: HausAnlegenService,
  ) {}

  /** Neues Haus ohne Interessent: ein Standort und eine Abteilung als Startpunkt. */
  @Post()
  @Schreibend()
  neu(@Aktuell() wer: Sitzung, @Body() dto: NeuesHausDto) {
    return this.anlegen.anlegen(wer, dto);
  }

  @Get() liste() {
    return this.haeuser.liste();
  }
  @Get(":id") detail(@Param("id") id: string) {
    return this.haeuser.detail(id);
  }

  /** Sperren statt Löschen: Aufbewahrungsfristen verlangen, dass die Daten erreichbar bleiben. */
  @Patch(":id/aktiv")
  @Schreibend()
  async aktiv(@Aktuell() wer: Sitzung, @Param("id") id: string, @Body() dto: AktivDto) {
    await this.haeuser.setzeAktiv(wer, id, dto.isActive);
    return { ok: true };
  }
  @Patch(":id/lizenz")
  @Schreibend()
  async lizenz(@Aktuell() wer: Sitzung, @Param("id") id: string, @Body() dto: LizenzDto) {
    await this.haeuser.setzeLizenz(wer, id, dto.licensedSeats ?? null);
    return { ok: true };
  }
  @Patch(":id/standortlimit")
  @Schreibend()
  async limit(@Aktuell() wer: Sitzung, @Param("id") id: string, @Body() dto: StandortlimitDto) {
    await this.haeuser.setzeStandortlimit(wer, id, dto.locationLimit ?? null);
    return { ok: true };
  }
  @Patch(":id/notiz")
  @Schreibend()
  async notiz(@Aktuell() wer: Sitzung, @Param("id") id: string, @Body() dto: NotizDto) {
    await this.haeuser.setzeNotiz(wer, id, dto.notes ?? null);
    return { ok: true };
  }
  @Put(":id/module/:key")
  @Schreibend()
  modul(@Aktuell() wer: Sitzung, @Param("id") id: string, @Param("key") key: string, @Body() dto: ModulDto) {
    return this.haeuser.setzeModul(wer, id, key, dto.enabled);
  }
}
