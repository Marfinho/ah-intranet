import { BadRequestException, Injectable } from "@nestjs/common";
import {
  GLOBAL_SCOPE,
  ZIELGRUPPEN_STUFEN,
  ZIELGRUPPEN_STUFEN_LABELS,
  istBekannteZielgruppe,
  parseZielgruppe,
  zielgruppenLabel,
} from "@ah-intranet/shared";
import type { ZielgruppenEintrag, ZielgruppenKatalog } from "@ah-intranet/shared";
import { PrismaService } from "./prisma.service";

/**
 * Der Zielgruppenkatalog eines Hauses - die Standorte, Abteilungen und
 * Fachbereiche, die es tatsächlich gibt.
 *
 * Bis hierher standen die wählbaren Zielgruppen als feste Liste in zwei
 * Oberflächen, mit den Codes der Demodaten. Für jede Gruppe, die nicht
 * zufällig Bremen, Delmenhorst und Achim betreibt, war die Auswahl damit
 * schlicht falsch. Die Wahrheit steht in den Stammdaten.
 */
@Injectable()
export class ZielgruppenService {
  constructor(private readonly prisma: PrismaService) {}

  async katalog(): Promise<ZielgruppenKatalog> {
    const [locations, departments, specialties] = await Promise.all([
      this.prisma.location.findMany({ select: { code: true, name: true }, orderBy: { name: "asc" } }),
      this.prisma.department.findMany({ select: { code: true, name: true }, orderBy: { name: "asc" } }),
      this.prisma.specialtyArea.findMany({ select: { code: true, name: true }, orderBy: { name: "asc" } }),
    ]);

    const eintraege: ZielgruppenEintrag[] = [
      ...locations.map((eintrag) => ({ stufe: "location" as const, ...eintrag })),
      ...departments.map((eintrag) => ({ stufe: "department" as const, ...eintrag })),
      ...specialties.map((eintrag) => ({ stufe: "specialty" as const, ...eintrag })),
    ];

    return { eintraege };
  }

  /**
   * Prüft die gewählten Zielgruppen gegen die Stammdaten und gibt sie
   * bereinigt zurück. Ohne Auswahl gilt die ganze Gruppe.
   *
   * Ein unbekanntes Token wird benannt und abgewiesen, nicht stillschweigend
   * verworfen: ein Aushang, den niemand sieht, wäre als Fehler erst dann
   * aufgefallen, wenn sich jemand über die fehlende Information beschwert.
   */
  async pruefe(tokens: string[] | undefined): Promise<string[]> {
    const gewaehlt = [...new Set((tokens ?? []).map((token) => token.trim()).filter(Boolean))];
    if (!gewaehlt.length) {
      return [GLOBAL_SCOPE];
    }

    // `global` schluckt alles Feinere - eine Mischung aus beidem wäre nur
    // scheinbar enger und würde die Anzeige der Zielgruppe zur Lüge machen.
    if (gewaehlt.includes(GLOBAL_SCOPE)) {
      return [GLOBAL_SCOPE];
    }

    // Zwei verschiedene Fehler, zwei verschiedene Sätze: ein verdrehtes Token
    // ist ein Fehler des Aufrufers, ein unbekannter Code meist eine gelöschte
    // Abteilung. Wer den Fehler liest, soll wissen, wo er suchen muss.
    const unbrauchbar = gewaehlt.filter((token) => parseZielgruppe(token) === null);
    if (unbrauchbar.length) {
      throw new BadRequestException(
        `Unbrauchbare Zielgruppe: ${unbrauchbar.join(", ")}. Erwartet wird die Reihenfolge ` +
          `${ZIELGRUPPEN_STUFEN.map((stufe) => ZIELGRUPPEN_STUFEN_LABELS[stufe]).join(" vor ")}.`,
      );
    }

    const katalog = await this.katalog();
    const unbekannt = gewaehlt.filter((token) => !istBekannteZielgruppe(token, katalog));
    if (unbekannt.length) {
      throw new BadRequestException(
        `Unbekannte Zielgruppe: ${unbekannt.join(", ")}. Wählbar sind ${this.wählbar(katalog)}.`,
      );
    }

    return gewaehlt;
  }

  /** Klartext der Zielgruppen eines Inhalts, für Anzeige und Protokoll. */
  async beschriftung(tokens: string[]): Promise<string> {
    return zielgruppenLabel(tokens, await this.katalog());
  }

  private wählbar(katalog: ZielgruppenKatalog): string {
    const stufen = [...new Set(katalog.eintraege.map((eintrag) => eintrag.stufe))];
    return stufen.map((stufe) => ZIELGRUPPEN_STUFEN_LABELS[stufe]).join(", ") || "nur „Alle Mitarbeitenden“";
  }
}
