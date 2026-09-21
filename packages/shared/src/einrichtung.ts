/**
 * Ersteinrichtungs-Assistent ("Einrichtung").
 *
 * Nicht zu verwechseln mit der Einarbeitung neuer Mitarbeitender
 * (`onboarding.*`, Modul-Key `"onboarding"`) - diese Funktion begleitet ein
 * frisch angelegtes Haus durch das Grundsetup: Organisationsdaten, erster
 * Standort, erste Mitarbeitende, erste News, optional ein Beispielprozess.
 *
 * Es gibt in AHOI keine festen Rollenschlüssel im Code (siehe
 * `packages/shared/src/rbac.ts`) - welche Variante des Flows jemand sieht,
 * wird deshalb ausschließlich aus den **Rechten** der Person abgeleitet, nicht
 * aus einem Rollennamen. So verwenden Backend und Frontend dieselbe, reine
 * Ableitungsregel.
 */

export const EINRICHTUNG_VARIANTEN = ["gruppenadmin", "standortleitung", "mitarbeiter"] as const;
export type EinrichtungVariante = (typeof EINRICHTUNG_VARIANTEN)[number];

/**
 * Rechte, die auf eine Führungs-/Freigabeposition hindeuten (ohne volle
 * Verwaltungshoheit). Jedes einzelne genügt für die standortleitung-Variante.
 */
const FUEHRUNGS_RECHTE = ["absences.approve", "orders.approve", "tickets.manage", "shifts.approve"] as const;

/**
 * Leitet aus den Rechten einer Person die passende Variante des
 * Einrichtungs-Assistenten ab.
 *
 * - `gruppenadmin`: volle Verwaltungshoheit (`users.manage` UND `roles.manage`,
 *   typischerweise die Grundausstattungsrolle `admin`) → volle Checkliste.
 * - `standortleitung`: mindestens ein Führungs-/Freigaberecht, aber nicht die
 *   volle Verwaltungshoheit → kurzer Hinweis-Flow.
 * - `mitarbeiter`: alle übrigen angemeldeten Personen → kürzester Flow.
 */
export function ermittleEinrichtungsVariante(permissions: readonly string[]): EinrichtungVariante {
  const hat = (permission: string) => permissions.includes(permission);

  if (hat("users.manage") && hat("roles.manage")) {
    return "gruppenadmin";
  }
  if (FUEHRUNGS_RECHTE.some(hat)) {
    return "standortleitung";
  }
  return "mitarbeiter";
}

/** Stabile Schritt-IDs über alle Varianten hinweg. */
export type EinrichtungsSchrittId =
  | "org_profil"
  | "standort"
  | "mitarbeiter"
  | "erste_news"
  | "beispielprozess"
  | "news_hinweis"
  | "freigaben_hinweis"
  | "modul_hinweis"
  | "eigene_aufgaben"
  | "profil_passwort";

export interface EinrichtungsSchritt {
  id: EinrichtungsSchrittId;
  titel: string;
  beschreibung: string;
  /** Zielseite im Frontend, die diesen Schritt ermöglicht. */
  href: string;
  /** Reihenfolge innerhalb der Variante. */
  reihenfolge: number;
  pflicht: boolean;
  /** Textliche Abschlussbedingung für Doku/Tooltips - geprüft wird serverseitig. */
  abschlussbedingung: string;
}

export const EINRICHTUNG_SCHRITTE: Record<EinrichtungVariante, EinrichtungsSchritt[]> = {
  gruppenadmin: [
    {
      id: "org_profil",
      titel: "Organisationsdaten vervollständigen",
      beschreibung: "Hinweise und Notizen zum Haus im Mandantenprofil hinterlegen.",
      href: "/admin",
      reihenfolge: 0,
      pflicht: true,
      abschlussbedingung: "Das Mandantenprofil trägt einen Hinweistext (notes).",
    },
    {
      id: "standort",
      titel: "Ersten Standort anlegen",
      beschreibung: "Mindestens ein Standort, an dem gearbeitet wird.",
      href: "/admin/organisation",
      reihenfolge: 1,
      pflicht: true,
      abschlussbedingung: "Mindestens ein Standort existiert für dieses Haus.",
    },
    {
      id: "mitarbeiter",
      titel: "Mitarbeitende einladen",
      beschreibung: "Mindestens ein weiteres Konto neben dem eigenen anlegen.",
      href: "/admin/benutzer",
      reihenfolge: 2,
      pflicht: true,
      abschlussbedingung: "Mindestens ein weiteres aktives Konto existiert.",
    },
    {
      id: "erste_news",
      titel: "Erste News veröffentlichen",
      beschreibung: "Einen Willkommensbeitrag für die Belegschaft veröffentlichen.",
      href: "/admin/news",
      reihenfolge: 3,
      pflicht: true,
      abschlussbedingung: "Mindestens ein veröffentlichter Beitrag existiert.",
    },
    {
      id: "beispielprozess",
      titel: "Einen Beispielprozess ausprobieren",
      beschreibung: "Ein erstes Ticket oder eine erste Bestellung anlegen, um den Ablauf zu sehen.",
      href: "/tickets",
      reihenfolge: 4,
      pflicht: false,
      abschlussbedingung: "Mindestens ein Ticket oder eine Bestellung wurde angelegt.",
    },
  ],
  standortleitung: [
    {
      id: "news_hinweis",
      titel: "Aktuelles im Blick behalten",
      beschreibung: "Der Bereich Aktuelles zeigt News für Ihre Zielgruppe.",
      href: "/aktuelles",
      reihenfolge: 0,
      pflicht: false,
      abschlussbedingung: "Der Bereich Aktuelles wurde besucht oder Beiträge wurden gelesen.",
    },
    {
      id: "freigaben_hinweis",
      titel: "Offene Freigaben und Aufgaben",
      beschreibung: "Freigaben, Tickets und Anträge, die auf eine Entscheidung warten.",
      href: "/freigaben",
      reihenfolge: 1,
      pflicht: false,
      abschlussbedingung: "Der Bereich Freigaben wurde besucht.",
    },
    {
      id: "modul_hinweis",
      titel: "Module Ihres Bereichs",
      beschreibung: "Schichtplan, Serviceanfragen und weitere Module je nach Zuständigkeit.",
      href: "/schichtplan",
      reihenfolge: 2,
      pflicht: false,
      abschlussbedingung: "Optionaler Hinweis, ohne Prüfbedingung.",
    },
  ],
  mitarbeiter: [
    {
      id: "news_hinweis",
      titel: "Aktuelles lesen",
      beschreibung: "Neuigkeiten aus Ihrem Haus finden Sie unter Aktuelles.",
      href: "/aktuelles",
      reihenfolge: 0,
      pflicht: false,
      abschlussbedingung: "Der Bereich Aktuelles wurde besucht.",
    },
    {
      id: "eigene_aufgaben",
      titel: "Eigene Aufgaben und Anträge",
      beschreibung: "Abwesenheiten beantragen und Serviceanfragen stellen.",
      href: "/abwesenheiten",
      reihenfolge: 1,
      pflicht: false,
      abschlussbedingung: "Der Bereich Abwesenheiten wurde besucht.",
    },
    {
      id: "profil_passwort",
      titel: "Profil und Passwort prüfen",
      beschreibung: "Kontaktdaten ergänzen und das Startpasswort ändern.",
      href: "/profil",
      reihenfolge: 2,
      pflicht: false,
      abschlussbedingung: "Das Profil wurde besucht.",
    },
  ],
};

/** Fortschritt je Schritt, wie er in `EinrichtungStatus.fortschritt` (JSON) steht. */
export type EinrichtungsFortschritt = Record<string, { done: boolean; completedAt: string | null }>;

export interface EinrichtungsSchrittStatus extends EinrichtungsSchritt {
  done: boolean;
  completedAt: string | null;
}

export interface EinrichtungStatusPayload {
  variante: EinrichtungVariante;
  willkommenGezeigt: boolean;
  uebersprungen: boolean;
  abgeschlossen: boolean;
  abgeschlossenAm: string | null;
  schritte: EinrichtungsSchrittStatus[];
}

/** Anzahl erledigter Pflichtschritte einer Variante, für die Fortschrittsanzeige. */
export function berechneFortschritt(schritte: EinrichtungsSchrittStatus[]): { erledigt: number; gesamt: number } {
  return {
    erledigt: schritte.filter((schritt) => schritt.done).length,
    gesamt: schritte.length,
  };
}

/** Sind alle Pflichtschritte einer Variante erledigt? */
export function pflichtschritteErledigt(schritte: EinrichtungsSchrittStatus[]): boolean {
  return schritte.filter((schritt) => schritt.pflicht).every((schritt) => schritt.done);
}
