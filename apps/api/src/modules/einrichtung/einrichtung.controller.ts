import { Controller, Get, HttpCode, Post } from "@nestjs/common";
import { EinrichtungService } from "./einrichtung.service";
import { CurrentUser } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

/**
 * Ersteinrichtungs-Assistent ("Einrichtung").
 *
 * Bewusst kein `@Feature(...)`: wie die Datenschutzfunktionen ist das
 * Kernfunktionalität, kein abschaltbares Fachmodul. Jede Route verlangt
 * lediglich eine gültige Sitzung (`JwtAuthGuard`, global aktiv) - kein
 * zusätzliches Recht, da jede Person nur ihren eigenen Status sieht und
 * ändert.
 */
@Controller("einrichtung")
export class EinrichtungController {
  constructor(private readonly einrichtung: EinrichtungService) {}

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return this.einrichtung.me(user);
  }

  @Post("welcome-seen")
  @HttpCode(200)
  welcomeSeen(@CurrentUser() user: RequestUser) {
    return this.einrichtung.markWelcomeSeen(user);
  }

  @Post("skip")
  @HttpCode(200)
  skip(@CurrentUser() user: RequestUser) {
    return this.einrichtung.skip(user);
  }

  @Post("restart")
  @HttpCode(200)
  restart(@CurrentUser() user: RequestUser) {
    return this.einrichtung.restart(user);
  }

  @Post("refresh-progress")
  @HttpCode(200)
  refreshProgress(@CurrentUser() user: RequestUser) {
    return this.einrichtung.refreshProgress(user);
  }
}
