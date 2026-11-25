import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsNotEmpty, IsString, Matches } from "class-validator";
import { Aktuell, Schreibend, type Sitzung } from "../../core/decorators";
import { AktualisierungService } from "./aktualisierung.service";
import { SHA_MUSTER } from "./regeln";

class AnfordernDto {
  @IsString() @Matches(SHA_MUSTER, { message: "Ungültiger Zielstand" }) zielSha!: string;
  @IsString() @IsNotEmpty({ message: "Bitte das Passwort zur Bestätigung eingeben" }) passwort!: string;
}

@Controller("aktualisierung")
export class AktualisierungController {
  constructor(private readonly aktualisierung: AktualisierungService) {}

  @Get() uebersicht() {
    return this.aktualisierung.uebersicht();
  }
  @Get(":id") auftrag(@Param("id") id: string) {
    return this.aktualisierung.auftrag(id);
  }

  @Post()
  @Schreibend()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  anfordern(@Aktuell() wer: Sitzung, @Body() dto: AnfordernDto) {
    return this.aktualisierung.anfordern(wer, dto.zielSha, dto.passwort);
  }

  @Post(":id/abbrechen")
  @Schreibend()
  @HttpCode(200)
  async abbrechen(@Aktuell() wer: Sitzung, @Param("id") id: string) {
    await this.aktualisierung.abbrechen(wer, id);
    return { ok: true };
  }
}
