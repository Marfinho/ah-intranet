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
