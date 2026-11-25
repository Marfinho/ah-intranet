import { Body, Controller, Get, Param, Patch, Put } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Aktuell, Schreibend, type Sitzung } from "../../core/decorators";
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

@Controller("haeuser")
export class HaeuserController {
  constructor(private readonly haeuser: HaeuserService) {}

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
