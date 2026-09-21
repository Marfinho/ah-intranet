import { Controller, Get } from "@nestjs/common";
import { ZielgruppenService } from "./zielgruppen.service";

/**
 * Bewusst ohne Recht: welche Standorte und Abteilungen es gibt, steht ohnehin
 * in den Filtern des Mitarbeiterverzeichnisses und in der Kopfzeile jedes
 * Kontos. Wer etwas veröffentlichen darf, entscheidet das Recht an der
 * schreibenden Route, nicht die Sichtbarkeit dieser Liste.
 */
@Controller("zielgruppen")
export class ZielgruppenController {
  constructor(private readonly zielgruppen: ZielgruppenService) {}

  @Get()
  katalog() {
    return this.zielgruppen.katalog();
  }
}
