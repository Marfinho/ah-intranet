/**
 * Preisliste und Angebotsrechnung - einzige Quelle der Wahrheit.
 *
 * Die Rechnung ist eine reine Funktion der Eingaben und dieser Liste. Sie läuft
 * im Browser des Interessenten (Live-Vorschau) und auf dem Server (maßgebliche
 * Zahl beim Speichern) mit demselben Code - so kann die Seite nie einen anderen
 * Preis zeigen, als die API später festhält.
 *
 * Alle Beträge sind ganze Cent, netto, je Monat bzw. einmalig. Gleitkommazahlen
 * kommen in der Rechnung nicht vor: 0,75 € je Nutzer mal 280 Nutzer muss genau
 * 210,00 € ergeben.
 *
 * Die Liste liegt im Code und nicht in der Datenbank. Eine Preisänderung ist
 * damit eine Änderung mit Prüfpipeline - und jedes Angebot hält ein Abbild
 * dessen fest, womit gerechnet wurde (`PREISLISTE_VERSION`), damit sich eine
 * einmal gezeigte Zahl nicht still ändert.
 */
import { MODULE_DEFINITIONS, getModule, type ModuleDefinition } from "./modules";

export type Cent = number;

/** Bei jeder Preisänderung hochzählen. Wird im Angebot festgehalten. */
export const PREISLISTE_VERSION = "2026-11";

export const TIER_KEYS = ["basis", "prozesse", "komplett"] as const;
export type TierKey = (typeof TIER_KEYS)[number];

export interface TierDefinition {
  key: TierKey;
  name: string;
  beschreibung: string;
  /** Monatlicher Basispreis des Tiers. */
  basisCent: Cent;
  /** Monatlicher Preis je aktivem Nutzerkonto. */
  nutzerCent: Cent;
  /** Enthaltene Module. Spätere Tiers enthalten alle Module der früheren. */
  module: readonly string[];
  /** Einmalig: Grundpaket der Einrichtung (Mandant, Rollen, Module, Logo, Administrationsschulung). */
  einrichtungCent: Cent;
  /** Einmalig: je weiteres Haus (Standort, Marken, Abteilungen, Import der Konten). */
  einrichtungJeHausCent: Cent;
}

const MODULE_BASIS = ["dashboard", "notifications", "admin", "news", "directory", "quicklinks", "documents"] as const;

const MODULE_PROZESSE = [...MODULE_BASIS, "orders", "approvals", "tickets", "absences"] as const;

/** Tier 3 trägt jedes Modul der Registry - auch kommende. Deshalb abgeleitet, nicht aufgezählt. */
const MODULE_KOMPLETT = MODULE_DEFINITIONS.map((modul) => modul.key as string);

export const TIERS: readonly TierDefinition[] = [
  {
    key: "basis",
    name: "Basis",
    beschreibung: "Aushänge, Verzeichnis, Dokumente und Schnellzugriffe für alle Häuser.",
    basisCent: 5000,
    nutzerCent: 75,
    module: MODULE_BASIS,
    einrichtungCent: 75000,
    einrichtungJeHausCent: 15000,
  },
  {
    key: "prozesse",
    name: "Prozesse",
    beschreibung: "Dazu Bestellungen mit Freigabe, Serviceanfragen und Abwesenheitsanträge.",
    basisCent: 10000,
    nutzerCent: 150,
    module: MODULE_PROZESSE,
    einrichtungCent: 150000,
    einrichtungJeHausCent: 25000,
  },
  {
    key: "komplett",
    name: "Komplett",
    beschreibung: "Alle Module, auch die Erprobungen, sobald der Betreiber sie für Ihr Haus freischaltet.",
    basisCent: 15000,
    nutzerCent: 300,
    module: MODULE_KOMPLETT,
    einrichtungCent: 250000,
    einrichtungJeHausCent: 35000,
  },
];

export function getTier(key: string): TierDefinition | undefined {
  return TIERS.find((tier) => tier.key === key);
}

export function isTierKey(key: string): key is TierKey {
  return TIER_KEYS.includes(key as TierKey);
}

/* ------------------------------------------------------------ Einzelmodule */

/**
 * Preis eines einzeln gewählten Moduls: ein fester Betrag je Monat plus ein
 * Betrag je Nutzer. Beides zusammen ist bewusst teurer als der Anteil, den das
 * Modul in einem Tier hat - sonst gäbe es keinen Grund, ein Tier zu nehmen.
 * Ein Test hält das für jede Nutzerzahl fest.
 */
export interface EinzelmodulPreis {
  grundCent: Cent;
  nutzerCent: Cent;
}

export const EINZELMODUL_STANDARD: EinzelmodulPreis = { grundCent: 1000, nutzerCent: 25 };

/** Abweichungen vom Standardpreis, nach Modulschlüssel. Heute keine. */
export const EINZELMODUL_PREISE: Readonly<Record<string, EinzelmodulPreis>> = {};

/** Basispreis bei Einzelwahl. Enthält die Kernmodule, die jedes Haus braucht. */
export const BASISPREIS_EINZELWAHL_CENT: Cent = 5000;

export function einzelmodulPreis(key: string): EinzelmodulPreis {
  return EINZELMODUL_PREISE[key] ?? EINZELMODUL_STANDARD;
}

/**
 * Module, die sich einzeln dazuwählen lassen.
 *
 * Kernmodule sind immer da, Erprobungen (`beta`) schaltet nur der Betreiber
 * frei - beide stehen deshalb nicht zur Wahl.
 */
export function waehlbareModule(): ModuleDefinition[] {
  return (MODULE_DEFINITIONS as readonly ModuleDefinition[]).filter((modul) => !modul.core && modul.stage === "stabil");
}

/** Gewählte Module samt Kernmodulen und Abhängigkeiten, ohne Erprobungen, in Registry-Reihenfolge. */
export function effektiveModule(auswahl: readonly string[]): string[] {
  const alle = MODULE_DEFINITIONS as readonly ModuleDefinition[];
  const gewaehlt = new Set<string>(alle.filter((modul) => modul.core).map((modul) => modul.key));
  const offen = auswahl.filter((key) => waehlbareModule().some((modul) => modul.key === key));

  while (offen.length > 0) {
    const key = offen.shift()!;
    if (gewaehlt.has(key)) {
      continue;
    }
    gewaehlt.add(key);
    offen.push(...(getModule(key)?.dependsOn ?? []));
  }

  return alle.filter((modul) => gewaehlt.has(modul.key)).map((modul) => modul.key);
}

/* ---------------------------------------------------------------- Rechnung */

export const NUTZER_MAX = 100_000;
export const HAEUSER_MAX = 1_000;
/** Personen je Schulungstermin. */
export const SCHULUNG_PERSONEN = 6;
export const SCHULUNG_TERMIN_CENT: Cent = 100000;

export interface AngebotEingabe {
  haeuser: number;
  nutzer: number;
  /** Zu schulende Personen. Ohne Angabe: anderthalb je Haus, aufgerundet. */
  keyUser?: number | null;
  /** Ein Tier, oder `null` für die Einzelwahl der Module. */
  tier: TierKey | null;
  /** Nur bei Einzelwahl: gewählte Module. */
  module?: readonly string[];
}

export interface AngebotZeile {
  art: "basis" | "nutzer" | "modul" | "einrichtung" | "schulung";
  text: string;
  cent: Cent;
}

export interface Angebot {
  modus: "tier" | "auswahl";
  tier: TierKey | null;
  haeuser: number;
  nutzer: number;
  keyUser: number;
  module: string[];
  monatlich: { zeilen: AngebotZeile[]; summeCent: Cent };
  einmalig: { zeilen: AngebotZeile[]; summeCent: Cent };
  jahrCent: Cent;
  /** Was dieselben wählbaren Module einzeln kosten würden. */
  einzelpreisCent: Cent;
  /** Einzelpreis minus Monatspreis im Tier - der Vorteil des Pakets. */
  ersparnisCent: Cent;
  /** Bei Einzelwahl: ein Tier, das mehr enthält und weniger kostet. */
  empfehlung: { tier: TierKey; monatlichCent: Cent; ersparnisCent: Cent } | null;
  hinweise: string[];
}

function ganzeZahl(wert: unknown, min: number, max: number, vorgabe: number): number {
  const zahl = Math.floor(Number(wert));
  if (!Number.isFinite(zahl)) {
    return vorgabe;
  }
  return Math.min(max, Math.max(min, zahl));
}

export function vorgabeKeyUser(haeuser: number): number {
  return Math.ceil(haeuser * 1.5);
}

/** Monatspreis einer Einzelwahl, ohne die Zeilen. Auch für den Vergleich mit einem Tier. */
function einzelwahlMonatlich(module: readonly string[], nutzer: number): { zeilen: AngebotZeile[]; summeCent: Cent } {
  const zeilen: AngebotZeile[] = [
    { art: "basis", text: "Basispreis inklusive Kernmodulen", cent: BASISPREIS_EINZELWAHL_CENT },
  ];
  for (const key of module) {
    const definition = getModule(key);
    if (!definition || definition.core) {
      continue;
    }
    const preis = einzelmodulPreis(key);
    zeilen.push({ art: "modul", text: definition.label, cent: preis.grundCent + preis.nutzerCent * nutzer });
  }
  return { zeilen, summeCent: zeilen.reduce((summe, zeile) => summe + zeile.cent, 0) };
}

function tierMonatlich(tier: TierDefinition, nutzer: number): { zeilen: AngebotZeile[]; summeCent: Cent } {
  const zeilen: AngebotZeile[] = [
    { art: "basis", text: `Basispreis Tier ${tier.name}`, cent: tier.basisCent },
    { art: "nutzer", text: `${nutzer} Nutzer`, cent: tier.nutzerCent * nutzer },
  ];
  return { zeilen, summeCent: tier.basisCent + tier.nutzerCent * nutzer };
}

/** Wählbare, stabile Module, die ein Tier enthält. */
function waehlbareImTier(tier: TierDefinition): string[] {
  return waehlbareModule()
    .map((modul) => modul.key as string)
    .filter((key) => tier.module.includes(key));
}

/**
 * Einrichtungsstufe bei Einzelwahl: nach Umfang.
 *
 * Wer so viele Module wählt wie ein Tier enthält, bekommt dessen Einrichtung -
 * der Aufwand hängt an der Zahl der Module, nicht an der Art, sie zu buchen.
 */
function einrichtungsstufe(anzahlModule: number): TierDefinition {
  return TIERS.find((tier) => anzahlModule <= tier.module.length) ?? TIERS[TIERS.length - 1];
}

export function berechneAngebot(eingabe: AngebotEingabe): Angebot {
  const haeuser = ganzeZahl(eingabe.haeuser, 1, HAEUSER_MAX, 1);
  const nutzer = ganzeZahl(eingabe.nutzer, 1, NUTZER_MAX, 1);
  const keyUser = ganzeZahl(eingabe.keyUser ?? vorgabeKeyUser(haeuser), 1, NUTZER_MAX, vorgabeKeyUser(haeuser));
  const tier = eingabe.tier ? (getTier(eingabe.tier) ?? null) : null;

  const module = tier ? [...tier.module] : effektiveModule(eingabe.module ?? []);
  const hinweise: string[] = [];

  const monatlich = tier ? tierMonatlich(tier, nutzer) : einzelwahlMonatlich(module, nutzer);

  const stufe = tier ?? einrichtungsstufe(module.length);
  const einmalZeilen: AngebotZeile[] = [
    { art: "einrichtung", text: "Einrichtung Grundpaket", cent: stufe.einrichtungCent },
  ];
  if (haeuser > 1) {
    einmalZeilen.push({
      art: "einrichtung",
      text: `Einrichtung weitere Häuser (${haeuser - 1} × ${stufe.einrichtungJeHausCent / 100} €)`,
      cent: (haeuser - 1) * stufe.einrichtungJeHausCent,
    });
  }
  const termine = Math.ceil(keyUser / SCHULUNG_PERSONEN);
  einmalZeilen.push({
    art: "schulung",
    text: `Schulung ${keyUser} Key-User (${termine} ${termine === 1 ? "Termin" : "Termine"})`,
    cent: termine * SCHULUNG_TERMIN_CENT,
  });
  const einmalSumme = einmalZeilen.reduce((summe, zeile) => summe + zeile.cent, 0);

  // Vergleich mit dem Einzelkauf derselben Module.
  const vergleichModule = tier ? waehlbareImTier(tier) : module;
  const einzelpreisCent = tier ? einzelwahlMonatlich(vergleichModule, nutzer).summeCent : monatlich.summeCent;
  const ersparnisCent = tier ? Math.max(0, einzelpreisCent - monatlich.summeCent) : 0;

  let empfehlung: Angebot["empfehlung"] = null;
  if (!tier) {
    const gewaehlt = module.filter((key) => !getModule(key)?.core);
    const passend = TIERS.filter((kandidat) => gewaehlt.every((key) => kandidat.module.includes(key)))
      .map((kandidat) => ({ tier: kandidat.key, monatlichCent: tierMonatlich(kandidat, nutzer).summeCent }))
      .filter((eintrag) => eintrag.monatlichCent < monatlich.summeCent)
      .sort((a, b) => a.monatlichCent - b.monatlichCent)[0];
    if (passend) {
      empfehlung = { ...passend, ersparnisCent: monatlich.summeCent - passend.monatlichCent };
    }
    hinweise.push("Erprobungen (Beta) gibt es nur im Tier Komplett und nach Freischaltung durch den Betreiber.");
  } else if (tier.module.some((key) => getModule(key)?.stage === "beta")) {
    hinweise.push(
      "Die Erprobungen (Schichtplan, Fundsachen & Schlüssel, Essensbestellung) sind enthalten, aber ausgeschaltet. Der Betreiber schaltet sie für Ihr Haus frei, wenn Sie sie erproben wollen.",
    );
  }

  return {
    modus: tier ? "tier" : "auswahl",
    tier: tier?.key ?? null,
    haeuser,
    nutzer,
    keyUser,
    module,
    monatlich,
    einmalig: { zeilen: einmalZeilen, summeCent: einmalSumme },
    jahrCent: monatlich.summeCent * 12,
    einzelpreisCent,
    ersparnisCent,
    empfehlung,
    hinweise,
  };
}

/** `1234567` → `12.345,67 €`. Für Oberfläche und Mail, nie für Rechnungen. */
export function formatEuro(cent: Cent): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cent / 100);
}
