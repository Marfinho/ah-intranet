import { getModule } from "./modules";

/**
 * Regeln der Pitch-Seite als reine Funktionen.
 *
 * Sie liegen im gemeinsamen Paket, weil Server und Browser dieselben Regeln
 * brauchen: der Server rechnet den ersten Vorschlag, der Browser rechnet neu,
 * sobald der Interessent ein Haus verändert. Bewusst ohne Datenbank und ohne
 * Textgenerator: der Vorschlag folgt aus den Angaben zum Haus und ist damit
 * nachvollziehbar und testbar.
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
  // Was in jedem Haus gebraucht wird, egal wie es arbeitet: Aushänge, Dokumente,
  // Schnellzugriffe, Verzeichnis und Urlaubsanträge. Ohne diese Grundlage stünde
  // ein gewähltes Modul in keinem Haus, und das Bild bliebe an der Stelle leer.
  const module: string[] = ["news", "directory", "documents", "quicklinks", "absences"];
  const saetze: string[] = [
    "Aushänge, Dokumente, Verzeichnis und Abwesenheitsanträge erreichen genau die Mitarbeitenden dieses Hauses.",
  ];

  const hatWerkstatt = hatServiceOderWerkstatt(standort.leistungen);

  if (hatWerkstatt) {
    // Freigaben hängen an den Bestellungen: wer bestellt, braucht auch den Freigabeweg.
    module.push("tickets", "orders", "approvals");
    saetze.push(
      "Werkstatt und Verkauf unter einem Dach: Serviceanfragen sowie Bestellungen mit Freigabe ohne Papierweg.",
    );
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

  if (istSonntagsgeoeffnet(standort.oeffnungszeiten)) {
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

export function hatServiceOderWerkstatt(leistungen: string[]): boolean {
  return nennt(leistungen, "service") || nennt(leistungen, "werkstatt");
}

/* ------------------------------------------------------------ Bearbeiten */

const SONNTAG = /\bso(nn)?(tag)?\b/i;

export function istSonntagsgeoeffnet(zeiten: string | null | undefined): boolean {
  return SONNTAG.test(zeiten ?? "");
}

/**
 * Schaltet "Sonntags geöffnet" in den Öffnungszeiten ein oder aus. Die übrigen
 * Zeiten bleiben stehen; ein Sonntagseintrag, den es schon gibt, wird nicht
 * doppelt angelegt.
 */
export function mitSonntag(zeiten: string | null | undefined, geoeffnet: boolean): string | null {
  const teile = (zeiten ?? "")
    .split(",")
    .map((teil) => teil.trim())
    .filter(Boolean);
  const ohne = teile.filter((teil) => !SONNTAG.test(teil));
  if (!geoeffnet) {
    return ohne.length > 0 ? ohne.join(", ") : null;
  }
  return teile.some((teil) => SONNTAG.test(teil)) ? teile.join(", ") : [...ohne, "So 11–16 Uhr"].join(", ");
}

/** Ein Haus, wie der Interessent es verändern darf. */
export interface PitchStandortEingabe {
  name: string;
  adresse: string | null;
  marken: string[];
  leistungen: string[];
  oeffnungszeiten: string | null;
  campus: string | null;
}

export const KUNDEN_HAEUSER_MAX = 200;

/**
 * Bereinigt Häuser, die der Interessent geschickt hat.
 *
 * Alles von der Pitch-Seite ist Eingabe: Texte werden gekürzt, Listen
 * dedupliziert, Häuser ohne Namen verworfen. Wie viele Häuser maximal, steht
 * fest - die Seite ist ohne Anmeldung erreichbar und darf keinen unbegrenzten
 * Speicher belegen.
 */
export function bereinigeKundenStandorte(liste: readonly PitchStandortEingabe[]): PitchStandortEingabe[] {
  const text = (wert: string | null | undefined, max: number) => {
    const getrimmt = (wert ?? "").trim().slice(0, max);
    return getrimmt || null;
  };
  const eintraege = (werte: readonly string[] | undefined) => [
    ...new Set(
      (werte ?? [])
        .map((eintrag) => eintrag.trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, 20),
    ),
  ];

  return liste
    .slice(0, KUNDEN_HAEUSER_MAX)
    .map((haus) => ({
      name: text(haus.name, 120) ?? "",
      adresse: text(haus.adresse, 240),
      marken: eintraege(haus.marken),
      leistungen: eintraege(haus.leistungen),
      oeffnungszeiten: text(haus.oeffnungszeiten, 200),
      campus: text(haus.campus, 80),
    }))
    .filter((haus) => haus.name !== "");
}
