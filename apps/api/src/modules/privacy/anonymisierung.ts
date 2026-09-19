/**
 * Regeln der Anonymisierung - bewusst als reine Funktionen.
 *
 * Eine Löschung auf Verlangen (Art. 17 DSGVO) darf aufbewahrungspflichtige
 * Vorgänge nicht mitreißen: eine freigegebene Bestellung muss zehn Jahre
 * nachvollziehbar bleiben. Statt den Datensatz zu entfernen, verliert er seinen
 * Personenbezug. Was dabei aus welchem Feld wird, steht hier an einer Stelle und
 * ist ohne Datenbank prüfbar.
 */

export interface AnonymisierteFelder {
  username: string;
  firstName: string;
  lastName: string;
  email: null;
  phone: null;
  mobile: null;
  jobTitle: string;
  responsibilities: string[];
  scopes: string[];
  status: "deleted";
  anonymizedAt: Date;
  /** Macht das Kennwort unbenutzbar, ohne die Spalte leer zu lassen. */
  passwordHash: string;
  /** Beendet sofort jede laufende Sitzung dieser Person. */
  tokenVersion: { increment: number };
  locationId: null;
  departmentId: null;
  specialtyAreaId: null;
  managerId: null;
}

/**
 * Kennung der anonymisierten Person.
 *
 * Braucht einen stabilen, eindeutigen Wert: `username` ist je Haus eindeutig,
 * und zwei anonymisierte Konten dürfen nicht kollidieren. Die ersten Zeichen
 * der Datensatz-ID leisten das, ohne die frühere Kennung zu verraten.
 */
export function anonymeKennung(userId: string): string {
  return `geloescht-${userId.slice(-8)}`;
}

export function anonymisierteFelder(userId: string, now: Date = new Date()): AnonymisierteFelder {
  const kennung = anonymeKennung(userId);
  return {
    username: kennung,
    firstName: "Gelöschte",
    lastName: "Person",
    email: null,
    phone: null,
    mobile: null,
    jobTitle: "—",
    responsibilities: [],
    scopes: [],
    status: "deleted",
    anonymizedAt: now,
    // Kein gültiger bcrypt-Hash: jeder Vergleich schlägt fehl, und es ist auf
    // den ersten Blick erkennbar, dass hier kein Kennwort mehr steht.
    passwordHash: "anonymisiert",
    tokenVersion: { increment: 1 },
    locationId: null,
    departmentId: null,
    specialtyAreaId: null,
    managerId: null,
  };
}

/**
 * Freitexte, die eine Person namentlich nennen können, lassen sich nicht
 * verlässlich maschinell bereinigen - ein Ticket kann "Rückfrage an Frau Meier"
 * enthalten, ohne dass ein Feld darauf zeigt. Statt so zu tun, als wäre das
 * erledigt, benennt die Auskunft diese Stellen und überlässt die Durchsicht dem
 * Haus.
 */
export const FREITEXT_STELLEN: readonly string[] = [
  "Kommentare zu Beiträgen",
  "Beschreibungen und Kommentare in Serviceanfragen",
  "Kommentare zu Bestellungen und Freigaben",
  "Inhalte von Wiki-Artikeln",
  "Beschreibungen von Ideen und Umfragen",
];
