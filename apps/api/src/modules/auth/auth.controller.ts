import { Body, Controller, Get, HttpCode, Post, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { PasswortService } from "./passwort.service";
import { CurrentUser, Public } from "../../core/decorators";
import { SESSION_COOKIE } from "../../core/guards";
import type { RequestUser } from "../../core/request-user";

class LoginDto {
  @IsString()
  @IsNotEmpty({ message: "Benutzername ist erforderlich" })
  username!: string;

  @IsString()
  @IsNotEmpty({ message: "Passwort ist erforderlich" })
  password!: string;

  /**
   * Kennung des Autohauses. Ausgewertet wird sie bereits in der
   * Mandanten-Middleware; hier steht sie, damit die Validierung sie durchlässt
   * und die Schnittstelle vollständig beschrieben ist.
   */
  @IsOptional()
  @IsString()
  tenant?: string;
}

class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(10, { message: "Das neue Passwort muss mindestens 10 Zeichen lang sein" })
  newPassword!: string;
}

class PasswortVergessenDto {
  @IsString()
  @IsNotEmpty({ message: "Benutzername ist erforderlich" })
  username!: string;

  /** Wie beim Anmelden: ausgewertet in der Mandanten-Middleware. */
  @IsOptional()
  @IsString()
  tenant?: string;
}

class PasswortNeuDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(10, { message: "Das neue Passwort muss mindestens 10 Zeichen lang sein" })
  password!: string;
}

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwort: PasswortService,
  ) {}

  /**
   * Fordert einen Zurücksetz-Link an.
   *
   * Antwortet immer mit 202 - ob es das Konto gibt, steht nicht in der Antwort.
   * Noch enger gedrosselt als die Anmeldung: drei Anforderungen pro Minute
   * genügen jedem Menschen und bremsen das Absuchen von Kennungen.
   */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post("passwort-vergessen")
  @HttpCode(202)
  async passwortVergessen(@Body() dto: PasswortVergessenDto) {
    await this.passwort.anfordern(dto.username);
    return {
      hinweis:
        "Wenn es zu dieser Kennung ein Konto mit hinterlegter E-Mail-Adresse gibt, ist eine Nachricht unterwegs.",
    };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post("passwort-neu")
  @HttpCode(200)
  async passwortNeu(@Body() dto: PasswortNeuDto) {
    await this.passwort.einloesen(dto.token, dto.password);
    return { hinweis: "Das Passwort ist gesetzt. Bitte melden Sie sich neu an." };
  }

  @Public()
  // Deutlich enger als die Grunddrosselung: zehn Versuche pro Minute und
  // Adresse reichen für Vertipper, nicht für systematisches Raten.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { token, user } = await this.authService.login(dto.username, dto.password);

    response.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: TWELVE_HOURS_MS,
      path: "/",
    });

    return { user };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@CurrentUser() user: RequestUser, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(user);
    response.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  }

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return this.authService.me(user);
  }

  @Post("password")
  @HttpCode(200)
  async changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }
}
