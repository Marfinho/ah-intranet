/**
 * Rollen- und Rechtemodell - einzige Quelle der Wahrheit.
 *
 * Der Katalog der **Rechte** steht fest: jedes Recht entspricht einer Stelle im
 * Code, die es prüft. Ein Haus kann kein Recht erfinden, das niemand liest.
 *
 * **Rollen** sind dagegen Daten des Hauses. Die Liste hier ist nur die
 * Grundausstattung, mit der ein neuer Mandant startet - sie lässt sich in der
 * Verwaltung ändern und um eigene Rollen ergänzen.
 */

/** Bereich, unter dem ein Recht in der Oberfläche einsortiert wird. */
export interface PermissionDefinition {
  key: string;
  name: string;
  description: string;
  /** Überschrift in der Rechteauswahl. */
  bereich: string;
}

export interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  /** Höherer Rang gewinnt, wenn eine Person mehrere Rollen hat. */
  rank: number;
  permissions: string[];
}

export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    key: "admin.access",
    name: "Verwaltung betreten",
    description: "Zugang zum Verwaltungsbereich und seiner Übersicht",
    bereich: "Verwaltung",
  },
  {
    key: "users.read",
    name: "Personalstamm einsehen",
    description: "Konten, Organisation und Rollenliste lesen",
    bereich: "Verwaltung",
  },
  {
    key: "users.manage",
    name: "Benutzer verwalten",
    description: "Konten anlegen, ändern, deaktivieren, Passwort zurücksetzen",
    bereich: "Verwaltung",
  },
  { key: "roles.manage", name: "Rollen verwalten", description: "Rollen und Rechte pflegen", bereich: "Verwaltung" },
  {
    key: "modules.manage",
    name: "Module steuern",
    description: "Fachmodule aktivieren und deaktivieren",
    bereich: "Verwaltung",
  },
  {
    key: "audit.read",
    name: "Audit-Log lesen",
    description: "Protokoll aller Aktionen einsehen",
    bereich: "Verwaltung",
  },
  {
    key: "organisation.manage",
    name: "Organisation verwalten",
    description: "Standorte (Autohäuser) und Abteilungen des Hauses anlegen, innerhalb der Lizenzgrenze",
    bereich: "Verwaltung",
  },
  {
    key: "auth.manage",
    name: "Anmeldeverfahren verwalten",
    description: "Zusätzliche Anmeldearten des Hauses hinterlegen und freischalten",
    bereich: "Verwaltung",
  },
  {
    key: "privacy.manage",
    name: "Datenschutz bearbeiten",
    description: "Auskunft erteilen, Konten anonymisieren, Fristen ausführen",
    bereich: "Verwaltung",
  },

  {
    key: "news.publish",
    name: "News veröffentlichen",
    description: "Beiträge erstellen, ändern, freigeben und Entwürfe sehen",
    bereich: "Aktuelles und Wissen",
  },
  {
    key: "documents.manage",
    name: "Dokumente pflegen",
    description: "Formulare und Dokumente einstellen und zurückziehen",
    bereich: "Aktuelles und Wissen",
  },
  {
    key: "wiki.manage",
    name: "Wissensseiten pflegen",
    description: "Seiten im Wissensbereich anlegen und ändern",
    bereich: "Aktuelles und Wissen",
  },
  {
    key: "quicklinks.manage",
    name: "Schnellzugriffe pflegen",
    description: "Kacheln auf der Startseite verwalten",
    bereich: "Aktuelles und Wissen",
  },

  {
    key: "orders.viewAll",
    name: "Alle Bestellungen sehen",
    description: "Vorgänge fremder Personen einsehen und begleiten",
    bereich: "Bestellungen",
  },
  {
    key: "orders.approve",
    name: "Bestellungen freigeben",
    description: "Freigabeentscheidungen treffen",
    bereich: "Bestellungen",
  },
  {
    key: "orders.bulk",
    name: "Sammelbestellung auslösen",
    description: "Freigegebene Vorgänge zur Sammelbestellung bündeln",
    bereich: "Bestellungen",
  },
  {
    key: "catalog.manage",
    name: "Kataloge pflegen",
    description: "Artikel, Formularfelder und Bestelltermine",
    bereich: "Bestellungen",
  },

  {
    key: "tickets.manage",
    name: "Serviceanfragen bearbeiten",
    description: "Fremde Anfragen sehen, zuweisen und lösen",
    bereich: "Anfragen und Anträge",
  },
  {
    key: "absences.approve",
    name: "Abwesenheiten freigeben",
    description: "Urlaubs- und Abwesenheitsanträge entscheiden",
    bereich: "Anfragen und Anträge",
  },
  {
    key: "absences.viewAll",
    name: "Alle Abwesenheiten sehen",
    description: "Anträge des ganzen Hauses statt nur des eigenen Teams",
    bereich: "Anfragen und Anträge",
  },
  {
    key: "ideas.manage",
    name: "Ideen und Umfragen steuern",
    description: "Ideen bewerten, Umfragen anlegen und schließen",
    bereich: "Anfragen und Anträge",
  },

  {
    key: "calendar.manage",
    name: "Termine pflegen",
    description: "Einträge im gemeinsamen Kalender anlegen und entfernen",
    bereich: "Organisation",
  },
  {
    key: "shifts.manage",
    name: "Schichtplan pflegen",
    description: "Schichten anlegen, besetzen und ändern",
    bereich: "Organisation",
  },
  {
    key: "shifts.approve",
    name: "Diensttausch freigeben",
    description: "Einen zwischen zwei Personen vereinbarten Tausch bestätigen",
    bereich: "Organisation",
  },
  {
    key: "custody.manage",
    name: "Verwahrung buchen",
    description: "Fundsachen und Schlüssel aufnehmen, ausgeben und zurücknehmen",
    bereich: "Organisation",
  },
  {
    key: "meals.manage",
    name: "Essensangebot pflegen",
    description: "Tagesangebot anlegen und die Sammelliste abrufen",
    bereich: "Organisation",
  },
  {
    key: "onboarding.manage",
    name: "Einarbeitung steuern",
    description: "Vorlagen pflegen und Einarbeitungen zuweisen",
    bereich: "Organisation",
  },
];

export const PERMISSION_KEYS: readonly string[] = PERMISSION_DEFINITIONS.map((permission) => permission.key);

/** Reihenfolge der Überschriften in der Rechteauswahl. */
export const PERMISSION_BEREICHE: readonly string[] = PERMISSION_DEFINITIONS.reduce<string[]>((liste, recht) => {
  if (!liste.includes(recht.bereich)) {
    liste.push(recht.bereich);
  }
  return liste;
}, []);

export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    key: "mitarbeiter",
    name: "Mitarbeitende",
    description: "Standardzugang: News lesen, bestellen, Anfragen und Anträge stellen.",
    rank: 0,
    permissions: [],
  },
  {
    key: "fuehrungskraft",
    name: "Führungskraft",
    description: "Zusätzlich: Abwesenheiten des Teams freigeben und Termine anlegen.",
    rank: 10,
    permissions: ["absences.approve", "calendar.manage", "shifts.manage", "shifts.approve"],
  },
  {
    key: "fachbereichsadmin",
    name: "Fachbereichsadmin",
    description: "Redaktion und Freigaben: Aktuelles, Bestellungen, Serviceanfragen, Kataloge.",
    rank: 20,
    permissions: [
      "admin.access",
      "users.read",
      "news.publish",
      "documents.manage",
      "wiki.manage",
      "orders.viewAll",
      "orders.approve",
      "orders.bulk",
      "catalog.manage",
      "tickets.manage",
      "absences.approve",
      "absences.viewAll",
      "ideas.manage",
      "calendar.manage",
      "onboarding.manage",
      "shifts.manage",
      "shifts.approve",
      "custody.manage",
      "meals.manage",
    ],
  },
  {
    key: "admin",
    name: "Administration",
    description: "Vollzugriff inklusive Benutzer, Rollen, Modulsteuerung, Datenschutz und Audit.",
    rank: 30,
    permissions: [...PERMISSION_KEYS],
  },
];

export function getPermission(key: string): PermissionDefinition | undefined {
  return PERMISSION_DEFINITIONS.find((permission) => permission.key === key);
}

export function isPermissionKey(key: string): boolean {
  return PERMISSION_KEYS.includes(key);
}

/** Klartextname eines Rechts für Fehlermeldungen. */
export function permissionName(key: string): string {
  return getPermission(key)?.name ?? key;
}

/**
 * Rechte, ohne die sich das Haus selbst aussperrt.
 *
 * Wer `roles.manage` aus der letzten Rolle entfernt, die ein aktives Konto
 * trägt, kann es nicht zurückgeben - der Rechte-Editor wäre unerreichbar.
 * Dasselbe gilt für die Benutzerverwaltung: ohne sie kommt kein neues
 * Administrationskonto mehr zustande.
 */
export const UNVERZICHTBARE_RECHTE: readonly string[] = ["roles.manage", "users.manage"];

/**
 * Schlüssel der Rollen aus der Grundausstattung.
 *
 * Sie lassen sich in Name, Beschreibung und Rechten ändern, aber nicht löschen:
 * der Seed und die Einrichtung neuer Mandanten setzen auf ihnen auf.
 */
export const SYSTEMROLLEN: readonly string[] = ROLE_DEFINITIONS.map((rolle) => rolle.key);

export function istSystemrolle(key: string): boolean {
  return SYSTEMROLLEN.includes(key);
}
