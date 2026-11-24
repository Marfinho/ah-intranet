import { createHash, randomBytes } from "node:crypto";
import { getModule } from "@ah-intranet/shared";

/**
 * Regeln der Pitch-Seite als reine Funktionen.
 *
 * Bewusst ohne Datenbank und ohne Textgenerator: der Vorschlag je Haus folgt
 * aus den Angaben, die der Betreiber eingetragen hat, und ist damit
 * nachvollziehbar und testbar. Wer es besser weiß, überschreibt den Text je
 * Haus von Hand.
 */

export interface StandortAngabe {
  name: string;
  marken: string[];
  leistungen: string[];
  oeffnungszeiten?: string | null;
  campus?: string | null;
}

export interface Vorschlag {
  /** Modulschlüssel, in der Reihenfolge der Regeln, ohne Doppelte. */
  module: string[];
  text: string;
}

function nennt(liste: string[], stichwort: string): boolean {
  return liste.some((eintrag) => eintrag.toLowerCase().includes(stichwort));
}

export function vorschlagFuerStandort(standort: StandortAngabe, alle: StandortAngabe[]): Vorschlag {
  const module: string[] = ["news"];
  const saetze: string[] = ["Aushänge erreichen genau die Mitarbeitenden dieses Hauses."];

  const hatWerkstatt = nennt(standort.leistungen, "service") || nennt(standort.leistungen, "werkstatt");

  if (hatWerkstatt) {
    module.push("tickets", "orders");
    saetze.push("Werkstatt und Verkauf unter einem Dach: Serviceanfragen und Bestellungen ohne Papierweg.");
  } else {
    module.push("tickets");
    saetze.push("Ohne eigene Werkstatt halten Serviceanfragen den Weg zur Technik kurz.");
  }

  const nachbarn = standort.campus
    ? alle.filter((anderer) => anderer !== standort && anderer.campus && anderer.campus === standort.campus)
    : [];
  if (nachbarn.length > 0) {
    module.push("rooms", "calendar", "directory");
    saetze.push(
      `Teilt sich den Standort mit ${nachbarn.map((anderer) => anderer.name).join(" und ")}: Raumbuchung, Kalender und Verzeichnis lassen sich gemeinsam nutzen.`,
    );
  }

  if (/\bso(nn)?(tag)?\b/i.test(standort.oeffnungszeiten ?? "")) {
    module.push("shifts");
    saetze.push("Sonntags geöffnet: ein Schichtplan mit Diensttausch (Erprobung) macht die Besetzung planbar.");
  }

  if (nennt(standort.marken, "gebrauchtwagen") || standort.name.toLowerCase().includes("gebrauchtwagen")) {
    module.push("custody");
    saetze.push(
      "Viele Schlüssel und Übergaben: Fundsachen & Schlüssel (Erprobung) hält fest, wer wann was in der Hand hatte. Die Bestandsführung bleibt im DMS.",
    );
  }

  return { module: [...new Set(module)].filter((key) => getModule(key)), text: saetze.join(" ") };
}

/* ------------------------------------------------------------------- Link */

/** Zufälliger Link-Bestandteil. 256 Bit, nicht erratbar. */
export function neuesToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Nur der Hash liegt in der Datenbank: ein Datenbankabzug öffnet keine Pitch-Seite. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const LINK_TAGE_STANDARD = 60;
export const LINK_TAGE_MAX = 365;

export function linkGueltigBis(tage: number, jetzt: Date = new Date()): Date {
  const begrenzt = Math.min(LINK_TAGE_MAX, Math.max(1, Math.floor(tage)));
  return new Date(jetzt.getTime() + begrenzt * 24 * 60 * 60 * 1000);
}

export function linkIstGueltig(
  lead: { tokenGueltigBis: Date; tokenWiderrufenAm: Date | null },
  jetzt: Date = new Date(),
) {
  return lead.tokenWiderrufenAm === null && lead.tokenGueltigBis.getTime() > jetzt.getTime();
}
