import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";
import { RETENTION_RULES } from "@ah-intranet/shared";
import { PrivacyService } from "./privacy.service";
import { CurrentUser, Permission } from "../../core/decorators";
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
 * Auskunft über die eigenen Daten.
 *
 * Bewusst ein eigener Controller **ohne** `privacy.manage`: Art. 15 DSGVO ist
 * ein Recht der betroffenen Person, kein Vorgang der Verwaltung. `docs/
 * datenschutz.md` verlangt unter "Mitbestimmung" ohnehin einen benannten
 * Auskunftsweg - der über einen Antrag bei der Administration läuft, solange
 * es diesen Weg nicht gibt.
 *
 * Es gibt hier keinen Parameter: die Auskunft betrifft immer das angemeldete
 * Konto. Ein `:userId` wäre eine Einladung, fremde Kennungen auszuprobieren.
 */
@Controller("meine-daten")
export class SelbstauskunftController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get("auskunft")
  auskunft(@CurrentUser() user: RequestUser) {
    return this.privacy.auskunft(user, user.id);
  }
}

/**
 * Datenschutzfunktionen der Administration.
 *
 * Bewusst **kein** abschaltbares Modul: Auskunft und Löschung sind gesetzliche
 * Pflichten. Ein Schalter, der sie entfernt, wäre ein Fehler im Entwurf.
 */
@Controller("datenschutz")
@Permission("privacy.manage")
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

  /**
   * Wann der Lauf zuletzt stattfand. Ohne diese Anzeige bliebe ein
   * ausgefallener Cron unbemerkt - und damit jede Frist wirkungslos.
   */
  @Get("aufbewahrung/status")
  laufStatus() {
    return this.privacy.laufStatus();
  }

  @Post("aufbewahrung/ausfuehren")
  @HttpCode(200)
  ausfuehren(@CurrentUser() user: RequestUser) {
    return this.privacy.aufraeumen(user);
  }

  @Get("auskunft/:userId")
  auskunft(@Param("userId") userId: string, @CurrentUser() user: RequestUser) {
    return this.privacy.auskunft(user, userId);
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
