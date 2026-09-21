import { Body, Controller, Get, HttpCode, Post, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { CurrentUser, Public } from "../../core/decorators";
import { SESSION_COOKIE, SICHERE_COOKIES } from "../../core/guards";
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

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
      // Muss zum Namen passen: ein `__Host-`-Cookie ohne `Secure` verwirft der
      // Browser wortlos. Beides kommt deshalb aus derselben Entscheidung.
      secure: SICHERE_COOKIES,
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
