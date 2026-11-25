import type { Angebot, TierKey } from "./preise";

/**
 * Typen der Interessenten-Verwaltung und der Pitch-Seite.
 *
 * Die Pitch-Seite bekommt bewusst weniger als die Verwaltung: Notizen und
 * Ansprechperson des Betreibers gehen nie an den Interessenten.
 */

export const LEAD_STATUS = ["entwurf", "versendet", "angefragt", "gewonnen", "verloren"] as const;
export type LeadStatusKey = (typeof LEAD_STATUS)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatusKey, string> = {
  entwurf: "Entwurf",
  versendet: "Versendet",
  angefragt: "Angefragt",
  gewonnen: "Gewonnen",
  verloren: "Verloren",
};

export interface LeadStandortItem {
  id?: string;
  name: string;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  marken: string[];
  leistungen: string[];
  oeffnungszeiten: string | null;
  campus: string | null;
  vorschlag: string | null;
}

export interface LeadKonfiguration {
  haeuser: number;
  nutzer: number;
  keyUser: number | null;
  tier: TierKey | null;
  module: string[];
}

export interface LeadSummary {
  id: string;
  name: string;
  status: LeadStatusKey;
  standorte: number;
  konfiguration: LeadKonfiguration;
  angefragtAm: string | null;
  linkGueltigBis: string;
  linkWiderrufen: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Was beim Anlegen des Hauses aus einem Interessenten entsteht. */
export interface HausVorschau {
  /** Woher die Häuser stammen: vom Interessenten, wenn er sie verändert hat. */
  quelle: "betreiber" | "interessent";
  bereitsAngelegt: boolean;
  hausId: string | null;
  /** Vorschlag, `null` wenn aus dem Namen keine gültige Kennung wird. */
  kennung: string | null;
  lizenzen: number;
  plan: {
    standorte: { name: string; code: string; adresse: string | null; marken: string[]; abteilungen: string[] }[];
    marken: { name: string; code: string }[];
    abteilungen: { name: string; code: string }[];
  };
  moduleZustand: { key: string; enabled: boolean }[];
  /** Module, die im Haus eingeschaltet sind. */
  modulAn: string[];
  /** Erprobungen, die zum Paket gehören, aber erst die Plattformverwaltung freischaltet. */
  modulErprobung: string[];
}

export interface LeadDetail extends LeadSummary {
  /** Das aus diesem Interessenten angelegte Haus. */
  hausId: string | null;
  /** Die Häuser, die der Interessent auf der Pitch-Seite verändert hat. `null`: nicht verändert. */
  kundenStandorte: LeadStandortItem[] | null;
  ansprechperson: string | null;
  notiz: string | null;
  standortListe: LeadStandortItem[];
  /** Angebot zum Zeitpunkt der Anfrage, mit der Preisliste von damals. */
  angebot: Angebot | null;
  preislisteVersion: string | null;
  /** Was die Preisliste von heute für die jetzige Konfiguration ergäbe. */
  angebotHeute: Angebot;
}

export interface PitchStandort {
  name: string;
  adresse: string | null;
  marken: string[];
  leistungen: string[];
  oeffnungszeiten: string | null;
  campus: string | null;
  vorschlagText: string;
  vorschlagModule: string[];
  /** Der Text stammt vom Betreiber, nicht aus den Regeln. Verändert der Interessent das Haus, rechnet die Seite neu. */
  vorschlagVonHand: boolean;
}

export interface PitchAnsicht {
  name: string;
  gueltigBis: string;
  angefragt: boolean;
  /** Die Häuser, wie sie gerade gelten: die des Interessenten, falls er sie verändert hat. */
  standorte: PitchStandort[];
  /** Die Häuser, wie der Betreiber sie erfasst hat. Dahin führt "Zurücksetzen". */
  ausgang: PitchStandort[];
  konfiguration: LeadKonfiguration;
}

/* ------------------------------------------------- Eingabe als Textzeilen */

/**
 * Häuser als Textzeilen, eine je Haus, Felder getrennt durch `|`:
 *
 *   Name | Straße | PLZ Ort | Marken | Leistungen | Öffnungszeiten | Verbund | Eigener Text
 *
 * Marken und Leistungen sind durch Komma getrennt. Alles nach dem Namen darf
 * fehlen. Ein Textfeld statt zehn Eingabefelder je Haus: wer acht Häuser aus
 * einer Webseite übernimmt, fügt sie in einem Zug ein.
 */
export function parseStandortText(text: string): LeadStandortItem[] {
  const liste = (wert: string | undefined) =>
    (wert ?? "")
      .split(",")
      .map((eintrag) => eintrag.trim())
      .filter(Boolean);
  const leer = (wert: string | undefined) => (wert?.trim() ? wert.trim() : null);

  return text
    .split(/\r?\n/)
    .map((zeile) => zeile.trim())
    .filter(Boolean)
    .map((zeile) => {
      const [name, strasse, plzOrt, marken, leistungen, zeiten, campus, vorschlag] = zeile
        .split("|")
        .map((teil) => teil.trim());
      const treffer = /^(\d{4,5})\s+(.+)$/.exec(plzOrt ?? "");
      return {
        name,
        strasse: leer(strasse),
        plz: treffer ? treffer[1] : null,
        ort: treffer ? treffer[2] : leer(plzOrt),
        marken: liste(marken),
        leistungen: liste(leistungen),
        oeffnungszeiten: leer(zeiten),
        campus: leer(campus),
        vorschlag: leer(vorschlag),
      };
    })
    .filter((standort) => standort.name);
}

export function formatStandortText(standorte: readonly LeadStandortItem[]): string {
  return standorte
    .map((standort) =>
      [
        standort.name,
        standort.strasse ?? "",
        [standort.plz, standort.ort].filter(Boolean).join(" "),
        standort.marken.join(", "),
        standort.leistungen.join(", "),
        standort.oeffnungszeiten ?? "",
        standort.campus ?? "",
        standort.vorschlag ?? "",
      ]
        .join(" | ")
        .replace(/(\s\|\s)+$/, ""),
    )
    .join("\n");
}
