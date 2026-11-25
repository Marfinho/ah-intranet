import { Body, Controller, Get, HttpCode, Post, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsNotEmpty, IsString, MinLength } from "class-validator";
import type { Response } from "express";
import { Aktuell, MfaEinrichtung, Public, type Sitzung } from "../../core/decorators";
import { DatenbankService } from "../../core/datenbank";
import { AuthService } from "./auth.service";
import { SITZUNGS_COOKIE } from "./auth.guard";

class AnmeldungDto {
  @IsString() @IsNotEmpty() username!: string;
  @IsString() @IsNotEmpty() passwort!: string;
}
class CodeDto {
  @IsString() @IsNotEmpty() zwischentoken!: string;
  @IsString() @IsNotEmpty() code!: string;
}
class BestaetigenDto {
  @IsString() @IsNotEmpty() code!: string;
}
class PasswortDto {
  @IsString() @IsNotEmpty() aktuell!: string;
  @IsString() @MinLength(12, { message: "Das Passwort muss mindestens 12 Zeichen lang sein" }) neu!: string;
}

const LAUFZEIT_MS = 8 * 60 * 60 * 1000;

function setzeCookie(antwort: Response, token: string) {
  antwort.cookie(SITZUNGS_COOKIE, token, {
    httpOnly: true,
    // Strict statt Lax: die Verwaltung wird nie von einer fremden Seite aus verlinkt bedient.
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: LAUFZEIT_MS,
    path: "/",
  });
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly db: DatenbankService,
  ) {}

  @Public()
  @Post("anmelden")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async anmelden(@Body() dto: AnmeldungDto, @Res({ passthrough: true }) antwort: Response) {
    const ergebnis = await this.auth.anmelden(dto.username, dto.passwort);
    if (ergebnis.sitzung) {
      setzeCookie(antwort, ergebnis.sitzung);
      return { mfaErforderlich: false, mfaEinrichten: true };
    }
    return { mfaErforderlich: true, zwischentoken: ergebnis.zwischentoken };
  }

  @Public()
  @Post("code")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async code(@Body() dto: CodeDto, @Res({ passthrough: true }) antwort: Response) {
    setzeCookie(antwort, await this.auth.pruefeCode(dto.zwischentoken, dto.code));
    return { ok: true };
  }

  @Get("ich")
  @MfaEinrichtung()
  async ich(@Aktuell() wer: Sitzung) {
    const konto = await this.db.betreiber.findUniqueOrThrow({ where: { id: wer.id } });
    return { ...wer, mfaEingerichtet: konto.totpEnabledAt !== null };
  }

  @Post("mfa/beginnen")
  @MfaEinrichtung()
  mfaBeginnen(@Aktuell() wer: Sitzung) {
    return this.auth.mfaBeginnen(wer.id, wer.username);
  }

  @Post("mfa/bestaetigen")
  @MfaEinrichtung()
  @HttpCode(200)
  async mfaBestaetigen(
    @Aktuell() wer: Sitzung,
    @Body() dto: BestaetigenDto,
    @Res({ passthrough: true }) antwort: Response,
  ) {
    const ergebnis = await this.auth.mfaBestaetigen(wer.id, dto.code);
    antwort.clearCookie(SITZUNGS_COOKIE, { path: "/" });
    return ergebnis;
  }

  @Post("passwort")
  @HttpCode(200)
  async passwort(@Aktuell() wer: Sitzung, @Body() dto: PasswortDto, @Res({ passthrough: true }) antwort: Response) {
    await this.auth.passwortAendern(wer.id, dto.aktuell, dto.neu);
    antwort.clearCookie(SITZUNGS_COOKIE, { path: "/" });
    return { ok: true };
  }

  @Post("abmelden")
  @MfaEinrichtung()
  @HttpCode(200)
  async abmelden(@Aktuell() wer: Sitzung, @Res({ passthrough: true }) antwort: Response) {
    await this.auth.abmelden(wer.id);
    antwort.clearCookie(SITZUNGS_COOKIE, { path: "/" });
    return { ok: true };
  }
}
