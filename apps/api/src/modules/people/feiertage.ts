/**
 * Gesetzliche Feiertage je Bundesland - als reine Rechnung.
 *
 * Das Ergebnis ist ein **Vorschlag**: Gemeinde- und konfessionsabhängige Tage
 * (Fronleichnam in Teilen von Sachsen und Thüringen, Mariä Himmelfahrt in
 * Bayern, das Augsburger Friedensfest) lassen sich nicht aus dem Bundesland
 * ableiten. Das Haus trägt sie von Hand ein oder streicht, was nicht zutrifft.
 */

export interface Feiertag {
  /** `YYYY-MM-DD` */
  datum: string;
  name: string;
}

/** Ostersonntag nach der Gaußschen Osterformel (gregorianisch, gültig ab 1583). */
export function ostersonntag(jahr: number): Date {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(jahr, monat - 1, tag));
}

function tage(basis: Date, differenz: number): Date {
  return new Date(basis.getTime() + differenz * 86_400_000);
}

/** Ein Datum als `YYYY-MM-DD` - UTC, damit die Zeitzone des Servers nichts verschiebt. */
export function datumText(datum: Date): string {
  return datum.toISOString().slice(0, 10);
}

/** Wochentag, 0 = Sonntag. */
function wochentag(text: string): number {
  return new Date(`${text}T00:00:00Z`).getUTCDay();
}

/** Mittwoch vor dem 23. November (Buß- und Bettag). */
function bussUndBettag(jahr: number): Date {
  const stichtag = new Date(Date.UTC(jahr, 10, 23));
  const rueckwaerts = (stichtag.getUTCDay() + 7 - 3) % 7 || 7;
  return tage(stichtag, -rueckwaerts);
}

const FRONLEICHNAM = ["BW", "BY", "HE", "NW", "RP", "SL"];
const HEILIGE_DREI_KOENIGE = ["BW", "BY", "ST"];
const FRAUENTAG = ["BE", "MV"];
const REFORMATIONSTAG = ["BB", "HB", "HH", "MV", "NI", "SN", "SH", "ST", "TH"];
const ALLERHEILIGEN = ["BW", "BY", "NW", "RP", "SL"];

/** Alle gesetzlichen Feiertage des Landes im Jahr, nach Datum sortiert. */
export function feiertage(jahr: number, bundesland: string): Feiertag[] {
  const ostern = ostersonntag(jahr);
  const liste: Feiertag[] = [
    { datum: `${jahr}-01-01`, name: "Neujahr" },
    { datum: datumText(tage(ostern, -2)), name: "Karfreitag" },
    { datum: datumText(tage(ostern, 1)), name: "Ostermontag" },
    { datum: `${jahr}-05-01`, name: "Tag der Arbeit" },
    { datum: datumText(tage(ostern, 39)), name: "Christi Himmelfahrt" },
    { datum: datumText(tage(ostern, 50)), name: "Pfingstmontag" },
    { datum: `${jahr}-10-03`, name: "Tag der Deutschen Einheit" },
    { datum: `${jahr}-12-25`, name: "1. Weihnachtstag" },
    { datum: `${jahr}-12-26`, name: "2. Weihnachtstag" },
  ];

  if (HEILIGE_DREI_KOENIGE.includes(bundesland)) {
    liste.push({ datum: `${jahr}-01-06`, name: "Heilige Drei Könige" });
  }
  if (FRAUENTAG.includes(bundesland)) {
    liste.push({ datum: `${jahr}-03-08`, name: "Internationaler Frauentag" });
  }
  if (FRONLEICHNAM.includes(bundesland)) {
    liste.push({ datum: datumText(tage(ostern, 60)), name: "Fronleichnam" });
  }
  if (bundesland === "SL") {
    liste.push({ datum: `${jahr}-08-15`, name: "Mariä Himmelfahrt" });
  }
  if (bundesland === "TH") {
    liste.push({ datum: `${jahr}-09-20`, name: "Weltkindertag" });
  }
  if (REFORMATIONSTAG.includes(bundesland)) {
    liste.push({ datum: `${jahr}-10-31`, name: "Reformationstag" });
  }
  if (ALLERHEILIGEN.includes(bundesland)) {
    liste.push({ datum: `${jahr}-11-01`, name: "Allerheiligen" });
  }
  if (bundesland === "SN") {
    liste.push({ datum: datumText(bussUndBettag(jahr)), name: "Buß- und Bettag" });
  }

  return liste.sort((a, b) => a.datum.localeCompare(b.datum));
}

/**
 * Brückentage: der Freitag nach einem Donnerstags-Feiertag und der Montag vor
 * einem Dienstags-Feiertag. Fällt der Brückentag selbst auf einen Feiertag,
 * entfällt er. Auch das ist ein Vorschlag - ob das Haus an dem Tag zu hat,
 * entscheidet es selbst.
 */
export function brueckentage(feiertageDesJahres: readonly Feiertag[]): Feiertag[] {
  const belegt = new Set(feiertageDesJahres.map((feiertag) => feiertag.datum));
  const ergebnis: Feiertag[] = [];
  for (const feiertag of feiertageDesJahres) {
    const tag = wochentag(feiertag.datum);
    const brueckentag =
      tag === 4
        ? datumText(tage(new Date(`${feiertag.datum}T00:00:00Z`), 1))
        : tag === 2
          ? datumText(tage(new Date(`${feiertag.datum}T00:00:00Z`), -1))
          : null;
    if (brueckentag && !belegt.has(brueckentag)) {
      ergebnis.push({ datum: brueckentag, name: `Brückentag (${feiertag.name})` });
    }
  }
  return ergebnis.sort((a, b) => a.datum.localeCompare(b.datum));
}
