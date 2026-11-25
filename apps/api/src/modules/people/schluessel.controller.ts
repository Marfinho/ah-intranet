import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Put } from "@nestjs/common";
import { IsIn, IsString } from "class-validator";
import { VERTRETUNGS_MELDUNGEN, type VertretungsMeldung } from "@ah-intranet/shared";
import { SchluesselService } from "./schluessel.service";
import { CurrentUser, Permission } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

class BesetzungDto {
  @IsString() userId!: string;
}

class MeldungDto {
  @IsIn(VERTRETUNGS_MELDUNGEN.map((eintrag) => eintrag.key)) vertretungsMeldung!: VertretungsMeldung;
}

@Controller("schluessel")
export class SchluesselController {
  constructor(private readonly schluessel: SchluesselService) {}

  /** Ohne Recht: wer wofür zuständig ist, soll jede kennen. Pflege und Kandidaten hängen am Recht. */
  @Get()
  uebersicht(@CurrentUser() user: RequestUser) {
    return this.schluessel.uebersicht(user);
  }

  @Patch("einstellung")
  @Permission("users.manage")
  einstellung(@CurrentUser() user: RequestUser, @Body() dto: MeldungDto) {
    return this.schluessel.setzeMeldung(user, dto.vertretungsMeldung);
  }

  @Put(":funktion/:stufe")
  @Permission("users.manage")
  besetzen(
    @CurrentUser() user: RequestUser,
    @Param("funktion") funktion: string,
    @Param("stufe", ParseIntPipe) stufe: number,
    @Body() dto: BesetzungDto,
  ) {
    return this.schluessel.besetzen(user, funktion, stufe, dto.userId);
  }

  @Delete(":funktion/:stufe")
  @HttpCode(200)
  @Permission("users.manage")
  leeren(
    @CurrentUser() user: RequestUser,
    @Param("funktion") funktion: string,
    @Param("stufe", ParseIntPipe) stufe: number,
  ) {
    return this.schluessel.leeren(user, funktion, stufe);
  }
}
