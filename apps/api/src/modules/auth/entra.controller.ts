import { BadRequestException, Controller, Get, Query, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { EntraService } from "./entra.service";
import { Public } from "../../core/decorators";
import { SESSION_COOKIE } from "../../core/guards";

const STATE_COOKIE = "ah_entra_state";
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

function frontendUrl(): string {
  return (process.env.FRONTEND_URL ?? "http://localhost:3000").split(",")[0].trim();
}

/**
 * Rücksprünge von Microsoft, keine JSON-Schnittstelle: Ein Browser landet
 * hier über eine echte Navigation, deshalb antworten beide Routen mit
 * Weiterleitungen statt mit Daten.
 */
@Controller("auth/entra")
export class EntraController {
  constructor(private readonly entra: EntraService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Get("login")
  async login(@Query("tenant") tenant: string | undefined, @Res() response: Response) {
    if (!tenant?.trim()) {
      throw new BadRequestException("Bitte die Kennung des Hauses angeben.");
    }

    const { url, state } = await this.entra.startLogin(tenant.trim().toLowerCase());

    response.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: TEN_MINUTES_MS,
      path: "/api/auth/entra",
    });
    response.redirect(url);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Get("callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Query("error_description") errorDescription: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const erwarteterState = (request.cookies as Record<string, string> | undefined)?.[STATE_COOKIE];
    response.clearCookie(STATE_COOKIE, { path: "/api/auth/entra" });

    const abweisen = (meldung: string) => {
      response.redirect(`${frontendUrl()}/login?fehler=${encodeURIComponent(meldung)}`);
    };

    if (error) {
      // "access_denied" heißt: die Person hat im Microsoft-Fenster abgebrochen.
      abweisen(
        error === "access_denied"
          ? "Die Anmeldung mit Microsoft wurde abgebrochen."
          : (errorDescription?.split(/\r?\n/)[0] ?? "Die Anmeldung mit Microsoft ist fehlgeschlagen."),
      );
      return;
    }
    if (!code || !state || !erwarteterState || state !== erwarteterState) {
      abweisen("Der Rücksprung von Microsoft konnte nicht zugeordnet werden. Bitte erneut anmelden.");
      return;
    }

    const tenantSlug = state.split(".")[0];
    try {
      const { token } = await this.entra.handleCallback(tenantSlug, code);
      response.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: TWELVE_HOURS_MS,
        path: "/",
      });
      response.redirect(frontendUrl());
    } catch (fehler) {
      abweisen(fehler instanceof Error ? fehler.message : "Die Anmeldung mit Microsoft ist fehlgeschlagen.");
    }
  }
}
