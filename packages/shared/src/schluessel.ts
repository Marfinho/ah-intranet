/**
 * Schlüsselfunktionen: zentrale Aufgaben, die ein Haus nie unbesetzt lassen darf.
 *
 * Die Liste steht im Code, weil jede Funktion an ein Recht gebunden ist: wer
 * sie trägt, muss auch tun dürfen, wofür er zuständig ist. Wer sie trägt, ist
 * dagegen Datensache des Hauses (`Schluesselbesetzung`).
 *
 * Jede Funktion hat drei Stufen: Key User, 1. Vertreter, 2. Vertreter. Ist
 * niemand davon erreichbar, geht die Sache an die Geschäftsführung.
 */

export interface SchluesselfunktionDefinition {
  key: string;
  name: string;
  beschreibung: string;
  /** Recht, das jede Person in dieser Funktion tragen muss - sonst wäre die Besetzung ein Papiertiger. */
  recht: string;
}

export const SCHLUESSELFUNKTIONEN: readonly SchluesselfunktionDefinition[] = [
  {
    key: "benutzerverwaltung",
    name: "Benutzerverwaltung",
    beschreibung: "Konten anlegen, sperren und Passwörter zurücksetzen",
    recht: "users.manage",
  },
  {
    key: "zweiter_faktor",
    name: "Zweiter Faktor",
    beschreibung: "Verlorene Telefone: den zweiten Faktor zurücksetzen",
    recht: "users.manage",
  },
  {
    key: "rollenverwaltung",
    name: "Rollen und Rechte",
    beschreibung: "Rollen pflegen und Rechte vergeben",
    recht: "roles.manage",
  },
  {
    key: "datenschutz",
    name: "Datenschutz",
    beschreibung: "Auskunftsersuchen beantworten, Konten anonymisieren",
    recht: "privacy.manage",
  },
];

export interface SchluesselStufe {
  stufe: number;
  name: string;
}

/** Reihenfolge der Erreichbarkeit: erst der Key User, dann die Vertreter. */
export const SCHLUESSEL_STUFEN: readonly SchluesselStufe[] = [
  { stufe: 0, name: "Key User" },
  { stufe: 1, name: "1. Vertreter" },
  { stufe: 2, name: "2. Vertreter" },
];

export function schluesselfunktion(key: string): SchluesselfunktionDefinition | undefined {
  return SCHLUESSELFUNKTIONEN.find((funktion) => funktion.key === key);
}

/**
 * Wann Vertretungen über eine Abwesenheit informiert werden.
 * `aus` - nie, `sofort` - beim Eintrag bzw. der Freigabe, `erster_tag` - am
 * ersten Tag der Abwesenheit (oder sofort, wenn sie schon läuft).
 */
export type VertretungsMeldung = "aus" | "sofort" | "erster_tag";

export const VERTRETUNGS_MELDUNGEN: readonly { key: VertretungsMeldung; name: string; beschreibung: string }[] = [
  { key: "sofort", name: "Sofort", beschreibung: "Sobald die Abwesenheit eingetragen oder genehmigt ist" },
  { key: "erster_tag", name: "Am ersten Tag", beschreibung: "Morgens am ersten Tag der Abwesenheit" },
  { key: "aus", name: "Aus", beschreibung: "Keine automatische Meldung an Vertretungen" },
];

export type SchluesselAmpel = "gruen" | "gelb" | "rot";

export interface SchluesselBesetzungEintrag {
  stufe: number;
  /** Konto in dieser Stufe, falls vergeben. */
  userId: string | null;
  name: string | null;
  /** Aktiv, mit Zugang und mit dem nötigen Recht - sonst zählt die Stufe nicht. */
  gueltig: boolean;
  /** Heute ganztägig abwesend. */
  abwesend: boolean;
}

export interface SchluesselfunktionAnsicht {
  key: string;
  name: string;
  beschreibung: string;
  recht: string;
  stufen: SchluesselBesetzungEintrag[];
  /** Wer heute zuständig ist; `null` heißt: niemand, die Geschäftsführung muss ran. */
  zustaendig: { userId: string; name: string; stufe: string } | null;
  ampel: SchluesselAmpel;
  /** Konten, die diese Stufe übernehmen könnten - nur für Berechtigte zur Pflege. */
  kandidaten: { id: string; name: string }[];
}

export interface SchluesselUebersicht {
  funktionen: SchluesselfunktionAnsicht[];
  vertretungsMeldung: VertretungsMeldung;
  /** Gibt es mindestens ein Konto mit dem Eskalationsrecht? Sonst geht die Eskalation an die Benutzerverwaltung. */
  geschaeftsfuehrungBesetzt: boolean;
  /** Nur für Träger des Eskalationsrechts: Funktionen, die heute niemand erreichbar trägt. */
  offeneEskalationen: string[] | null;
}
