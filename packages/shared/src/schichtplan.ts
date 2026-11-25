/**
 * Typen für Schichtarten, Arbeitszeitprofile, Autoplanung und Arbeitszeitprüfung.
 */

/** ISO-Wochentage, wie sie Schichtarten und Arbeitszeitprofile führen: 1 = Montag ... 7 = Sonntag. */
export const WOCHENTAGE: readonly { nummer: number; kurz: string; name: string }[] = [
  { nummer: 1, kurz: "Mo", name: "Montag" },
  { nummer: 2, kurz: "Di", name: "Dienstag" },
  { nummer: 3, kurz: "Mi", name: "Mittwoch" },
  { nummer: 4, kurz: "Do", name: "Donnerstag" },
  { nummer: 5, kurz: "Fr", name: "Freitag" },
  { nummer: 6, kurz: "Sa", name: "Samstag" },
  { nummer: 7, kurz: "So", name: "Sonntag" },
];

export type ArbeitszeitSchwere = "verstoss" | "hinweis";

export interface SchichtartItem {
  id: string;
  name: string;
  startZeit: string;
  endZeit: string;
  pauseMinuten: number;
  mindestBesetzung: number;
  idealBesetzung: number;
  tage: number[];
  beiSondertag: boolean;
  aktiv: boolean;
  locationId: string | null;
  departmentId: string | null;
  teamLeadId: string | null;
  /** Lesbar: „Bremen · Service · Team Meyer" oder „Ganzes Haus". */
  bereich: string;
  /** Hinweise nach dem Arbeitszeitgesetz zur Vorlage selbst. */
  befunde: { schwere: ArbeitszeitSchwere; text: string }[];
}

export interface ArbeitszeitProfil {
  id: string;
  displayName: string;
  hasAccess: boolean;
  location: string | null;
  department: string | null;
  wochenstunden: number | null;
  zeitfensterVon: string | null;
  zeitfensterBis: string | null;
  arbeitstage: number[];
}

export interface PlanZuweisung {
  schichtartId: string;
  schichtart: string;
  datum: string;
  start: string;
  ende: string;
  userId: string;
  name: string;
}

export interface PlanLuecke {
  schichtartId: string;
  schichtart: string;
  datum: string;
  soll: number;
  mindest: number;
  besetzt: number;
  unterMindest: boolean;
}

export interface PlanVorschau {
  von: string;
  bis: string;
  zuweisungen: PlanZuweisung[];
  luecken: PlanLuecke[];
  /** Personen ohne hinterlegte Wochenstunden: für sie gilt keine Obergrenze. */
  ohneWochenstunden: string[];
}

export interface ArbeitszeitBefund {
  art: "ruhezeit" | "hoechstarbeitszeit" | "pause" | "wochenstunden";
  schwere: ArbeitszeitSchwere;
  userId: string;
  name: string;
  datum: string;
  text: string;
}

/* --------------------------------------------------------------- Entwürfe */

/**
 * Eine Schicht im Entwurf. Der Entwurf kennt die Schichten **vollständig**: was
 * dort fehlt, wird nicht angefasst (es bleibt im echten Plan), was dort steht,
 * wird beim Veröffentlichen angelegt oder geändert.
 */
export interface PlanEntwurfItem {
  /** Vom Browser vergeben; ändert sich nie, auch wenn Zeiten oder Person wechseln. */
  key: string;
  /** Die echte Schicht, aus der dieses Element entstand; leer bei neuen. */
  liveId: string | null;
  /** `updatedAt` der echten Schicht beim Anlegen des Entwurfs - erkennt Änderungen von anderer Seite. */
  liveStand: string | null;
  label: string;
  startsAt: string;
  endsAt: string;
  pauseMinuten: number;
  assigneeId: string | null;
  schichtartId: string | null;
  locationId: string | null;
  departmentId: string | null;
  note: string | null;
  /** Nur bei Elementen mit `liveId`: die echte Schicht soll beim Veröffentlichen entfallen. */
  geloescht?: boolean;
}

export type PlanEntwurfBasis = "leer" | "bestand";

export interface PlanEntwurfKopf {
  id: string;
  name: string;
  von: string;
  bis: string;
  basis: PlanEntwurfBasis;
  version: number;
  aktualisiertAm: string;
  aktualisiertVon: string | null;
  erstelltVon: string;
  anzahl: number;
}

export interface PlanEntwurf extends PlanEntwurfKopf {
  items: PlanEntwurfItem[];
}

export interface EntwurfKonflikt {
  /** Schlüssel der beiden Elemente (Entwurf: `key`, feste echte Schicht: ihre ID). */
  a: string;
  b: string;
  text: string;
}

export interface EntwurfPruefung {
  /** Hinweise und Verstöße nach Arbeitszeitgesetz im Endzustand des Entwurfs. */
  befunde: ArbeitszeitBefund[];
  /** Dieselbe Person zweimal zur selben Zeit - das verhindert das Veröffentlichen. */
  konflikte: EntwurfKonflikt[];
}

export interface EntwurfSpeicherung extends EntwurfPruefung {
  version: number;
  aktualisiertAm: string;
}

export interface EntwurfVorschlag {
  /** Neu eingeteilte Schichten und offene Schichten für Lücken zur Mindestbesetzung. */
  neu: PlanEntwurfItem[];
  /** Offene Elemente der geplanten Schichtarten, die der Vorschlag ersetzt. */
  entfernen: string[];
  luecken: PlanLuecke[];
  ohneWochenstunden: string[];
}

export interface Veroeffentlichung {
  angelegt: number;
  geaendert: number;
  entfernt: number;
  benachrichtigt: number;
}
