import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { DatenbankService } from "../../core/datenbank";
import { MFA_EINRICHTUNG_KEY, PUBLIC_KEY, SCHREIBEND_KEY, type Sitzung } from "../../core/decorators";
import type { SitzungsToken } from "./auth.service";

export const SITZUNGS_COOKIE = "ahoi_verwaltung";

/**
 * Authentifizierung und Rechteprüfung in einem Guard - die Verwaltung kennt nur
 * zwei Rollen, eine eigene Rechte-Registry wäre vorgebaut. Die Gültigkeit der
 * Sitzung wird bei jeder Anfrage gegen die Datenbank geprüft, damit Sperre und
 * Passwortwechsel sofort wirken.
 */
@Injectable()
export class SitzungsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly db: DatenbankService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ziele = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, ziele)) {
      return true;
    }

    const anfrage = context.switchToHttp().getRequest<Request & { betreiber?: Sitzung }>();
    const token = anfrage.cookies?.[SITZUNGS_COOKIE] as string | undefined;
    if (!token) {
      throw new UnauthorizedException("Nicht angemeldet");
    }

    let inhalt: SitzungsToken;
    try {
      inhalt = await this.jwt.verifyAsync<SitzungsToken>(token);
    } catch {
      throw new UnauthorizedException("Sitzung abgelaufen oder ungültig");
    }

    const konto = await this.db.betreiber.findUnique({ where: { id: inhalt.sub } });
    if (!konto || !konto.aktiv || konto.tokenVersion !== inhalt.tokenVersion) {
      throw new UnauthorizedException("Die Sitzung wurde beendet. Bitte erneut anmelden.");
    }

    if (inhalt.mfaOffen && !this.reflector.getAllAndOverride<boolean>(MFA_EINRICHTUNG_KEY, ziele)) {
      throw new ForbiddenException("Bitte richten Sie zuerst den zweiten Faktor ein.");
    }
    if (this.reflector.getAllAndOverride<boolean>(SCHREIBEND_KEY, ziele) && konto.rolle !== "inhaber") {
      throw new ForbiddenException("Diese Rolle darf nur lesen.");
    }

    anfrage.betreiber = { id: konto.id, username: konto.username, displayName: konto.displayName, rolle: konto.rolle };
    return true;
  }
}
