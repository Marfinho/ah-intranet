/**
 * Rollen- und Rechtemodell - einzige Quelle der Wahrheit.
 *
 * Wird sowohl vom Seed als auch von der Einrichtung neuer Mandanten benutzt:
 * Jedes Autohaus bekommt dieselbe Grundausstattung an Rollen, sonst verhielten
 * sich Rechteprüfungen von Haus zu Haus unterschiedlich.
 */

export interface PermissionDefinition {
  key: string;
  name: string;
  description: string;
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
  { key: "news.publish", name: "News veröffentlichen", description: "Beiträge erstellen und freigeben" },
  { key: "orders.approve", name: "Bestellungen freigeben", description: "Freigabeentscheidungen treffen" },
  { key: "orders.bulk", name: "Sammelbestellung auslösen", description: "Externe Sammelbestellung übergeben" },
  { key: "users.manage", name: "Benutzer verwalten", description: "Konten anlegen, ändern, deaktivieren" },
  { key: "roles.manage", name: "Rollen verwalten", description: "Rollen und Rechte pflegen" },
  { key: "modules.manage", name: "Module steuern", description: "Fachmodule aktivieren und deaktivieren" },
  { key: "catalog.manage", name: "Kataloge pflegen", description: "Artikel, Formularfelder, Bestelltermine" },
  { key: "tickets.manage", name: "Tickets bearbeiten", description: "Serviceanfragen zuweisen und lösen" },
  { key: "absences.approve", name: "Abwesenheiten freigeben", description: "Urlaubsanträge entscheiden" },
  { key: "audit.read", name: "Audit-Log lesen", description: "Protokoll aller Aktionen einsehen" },
];

export const PERMISSION_KEYS: readonly string[] = PERMISSION_DEFINITIONS.map((permission) => permission.key);

export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    key: "mitarbeiter",
    name: "Mitarbeitende",
    description: "Standardzugang: News lesen, bestellen, Tickets und Anträge stellen.",
    rank: 0,
    permissions: [],
  },
  {
    key: "fuehrungskraft",
    name: "Führungskraft",
    description: "Zusätzlich: Abwesenheiten des Teams freigeben und Termine anlegen.",
    rank: 10,
    permissions: ["absences.approve"],
  },
  {
    key: "fachbereichsadmin",
    name: "Fachbereichsadmin",
    description: "Redaktion und Freigaben: News, Bestellungen, Tickets, Kataloge.",
    rank: 20,
    permissions: [
      "news.publish",
      "orders.approve",
      "orders.bulk",
      "catalog.manage",
      "tickets.manage",
      "absences.approve",
    ],
  },
  {
    key: "admin",
    name: "Administration",
    description: "Vollzugriff inklusive Benutzer, Rollen, Modulsteuerung und Audit.",
    rank: 30,
    permissions: [...PERMISSION_KEYS],
  },
];
