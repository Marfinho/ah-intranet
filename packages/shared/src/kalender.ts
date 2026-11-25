/**
 * Betriebskalender: Bundesländer und die Arten von Sondertagen.
 *
 * Beides steht fest im Code, weil die Feiertagsrechnung darauf aufsetzt. Welche
 * Tage ein Haus tatsächlich führt, ist dagegen Datensache (`Betriebstag`).
 */

export interface BundeslandDefinition {
  code: string;
  name: string;
}

export const BUNDESLAENDER: readonly BundeslandDefinition[] = [
  { code: "BW", name: "Baden-Württemberg" },
  { code: "BY", name: "Bayern" },
  { code: "BE", name: "Berlin" },
  { code: "BB", name: "Brandenburg" },
  { code: "HB", name: "Bremen" },
  { code: "HH", name: "Hamburg" },
  { code: "HE", name: "Hessen" },
  { code: "MV", name: "Mecklenburg-Vorpommern" },
  { code: "NI", name: "Niedersachsen" },
  { code: "NW", name: "Nordrhein-Westfalen" },
  { code: "RP", name: "Rheinland-Pfalz" },
  { code: "SL", name: "Saarland" },
  { code: "SN", name: "Sachsen" },
  { code: "ST", name: "Sachsen-Anhalt" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "TH", name: "Thüringen" },
];

export function istBundesland(code: string): boolean {
  return BUNDESLAENDER.some((land) => land.code === code);
}

export type BetriebstagArt = "feiertag" | "brueckentag" | "verkaufsoffen" | "betriebsfrei" | "sondertag";

export interface BetriebstagArtDefinition {
  key: BetriebstagArt;
  name: string;
  /** Vorbelegung: zählt der Tag standardmäßig als arbeitsfrei? */
  arbeitsfreiStandard: boolean;
  beschreibung: string;
}

export const BETRIEBSTAG_ARTEN: readonly BetriebstagArtDefinition[] = [
  { key: "feiertag", name: "Feiertag", arbeitsfreiStandard: true, beschreibung: "Gesetzlicher Feiertag" },
  {
    key: "brueckentag",
    name: "Brückentag",
    arbeitsfreiStandard: true,
    beschreibung: "Tag zwischen Feiertag und Wochenende, an dem das Haus geschlossen ist",
  },
  {
    key: "verkaufsoffen",
    name: "Verkaufsoffener Sonntag",
    arbeitsfreiStandard: false,
    beschreibung: "Sonst arbeitsfreier Tag, an dem geöffnet ist und gearbeitet wird",
  },
  {
    key: "betriebsfrei",
    name: "Betriebsfrei",
    arbeitsfreiStandard: true,
    beschreibung: "Betriebsurlaub, Inventur, Betriebsfeier - das Haus ist zu",
  },
  {
    key: "sondertag",
    name: "Sondertag",
    arbeitsfreiStandard: false,
    beschreibung: "Sonstiger Termin, der die Planung betrifft (z. B. Hausmesse)",
  },
];

export function betriebstagArt(key: string): BetriebstagArtDefinition | undefined {
  return BETRIEBSTAG_ARTEN.find((art) => art.key === key);
}

/** Ein Tag des Betriebskalenders, wie ihn die Oberfläche bekommt. */
export interface BetriebstagEintrag {
  id: string;
  /** `null` = gilt für das ganze Haus. */
  locationId: string | null;
  /** ISO-Datum `YYYY-MM-DD`: ein Kalendertag, kein Zeitpunkt. */
  datum: string;
  art: BetriebstagArt;
  name: string;
  arbeitsfrei: boolean;
}

/** Vorschlag aus der Rechnung - noch nicht im Kalender des Hauses. */
export interface BetriebstagVorschlag {
  locationId: string;
  datum: string;
  art: BetriebstagArt;
  name: string;
  arbeitsfrei: boolean;
}

export interface BetriebskalenderAnsicht {
  jahr: number;
  standorte: { id: string; name: string; bundesland: string | null }[];
  eintraege: BetriebstagEintrag[];
  vorschlaege: BetriebstagVorschlag[];
}
