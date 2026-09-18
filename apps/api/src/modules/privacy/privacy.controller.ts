import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";
import { RETENTION_RULES } from "@ah-intranet/shared";
import { PrivacyService } from "./privacy.service";
import { CurrentUser, Roles } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

class LoeschungDto {
  /**
   * Der Vorgang ist unumkehrbar. Ein ausdrückliches Bestätigungsfeld verhindert,
   * dass ein versehentlicher Aufruf ein Konto entwertet.
   */
  @IsBoolean()
  bestaetigt!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: "Bitte den Anlass der Löschung festhalten" })
  anlass?: string;
}

/**
 * Datenschutzfunktionen der Administration.
 *
 * Bewusst **kein** abschaltbares Modul: Auskunft und Löschung sind gesetzliche
 * Pflichten. Ein Schalter, der sie entfernt, wäre ein Fehler im Entwurf.
 */
@Controller("datenschutz")
@Roles("admin")
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  /** Die geltenden Fristen - Grundlage für Oberfläche und Dokumentation. */
  @Get("aufbewahrung")
  fristen() {
    return RETENTION_RULES;
  }

  /** Was ein Aufräumlauf heute entfernen würde, ohne etwas zu verändern. */
  @Get("aufbewahrung/vorschau")
  vorschau() {
    return this.privacy.vorschau();
  }

  @Post("aufbewahrung/ausfuehren")
  @HttpCode(200)
  ausfuehren(@CurrentUser() user: RequestUser) {
    return this.privacy.aufraeumen(user);
  }

  @Get("auskunft/:userId")
  auskunft(@Param("userId") userId: string) {
    return this.privacy.auskunft(userId);
  }

  @Delete("person/:userId")
  @HttpCode(200)
  loeschen(@Param("userId") userId: string, @Body() dto: LoeschungDto, @CurrentUser() user: RequestUser) {
    if (!dto.bestaetigt) {
      return { ok: false, message: "Die Löschung muss ausdrücklich bestätigt werden." };
    }
    return this.privacy.loeschen(user, userId);
  }
}
