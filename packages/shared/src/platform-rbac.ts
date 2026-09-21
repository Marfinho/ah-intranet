/**
 * Rechtekatalog der Plattformverwaltung - einzige Quelle der Wahrheit.
 *
 * Getrennt von `rbac.ts`, weil es ein anderes Subjekt hat: Rechte dort gehören
 * einem Haus und werden über Rollen vergeben, die das Haus selbst pflegt.
 * Plattformrechte gehören dem Betreiber und werden einzelnen Konten direkt
 * zugewiesen - es gibt keine "Rolle" der Plattform, weil dafür schlicht zu
 * wenige Personen infrage kommen. `isPlatformAdmin` trägt weiterhin alle
 * Plattformrechte implizit; wer Mandanten anlegen darf, braucht keine
 * Einzelfreischaltung für schwächere Aufgaben.
 *
 * Der Katalog wächst nur mit neuen Funktionen der Plattformverwaltung - kein
 * Vorbauen auf Verdacht.
 */

export interface PlatformPermissionDefinition {
  key: string;
  name: string;
  description: string;
  /** Überschrift in der Rechteauswahl der Mitarbeiterverwaltung. */
  bereich: string;
}

export const PLATFORM_PERMISSION_DEFINITIONS: readonly PlatformPermissionDefinition[] = [
  {
    key: "support.tickets.view",
    name: "Support-Anfragen einsehen",
    description: "Support-Anfragen aller Häuser lesen",
    bereich: "Support",
  },
  {
    key: "support.tickets.manage",
    name: "Support-Anfragen bearbeiten",
    description: "Anfragen beantworten, zuweisen und deren Status ändern",
    bereich: "Support",
  },
];

export const PLATFORM_PERMISSION_KEYS: readonly string[] = PLATFORM_PERMISSION_DEFINITIONS.map(
  (permission) => permission.key,
);

export const PLATFORM_PERMISSION_BEREICHE: readonly string[] = PLATFORM_PERMISSION_DEFINITIONS.reduce<string[]>(
  (liste, recht) => {
    if (!liste.includes(recht.bereich)) {
      liste.push(recht.bereich);
    }
    return liste;
  },
  [],
);

export function getPlatformPermission(key: string): PlatformPermissionDefinition | undefined {
  return PLATFORM_PERMISSION_DEFINITIONS.find((permission) => permission.key === key);
}

export function isPlatformPermissionKey(key: string): boolean {
  return PLATFORM_PERMISSION_KEYS.includes(key);
}

export function platformPermissionName(key: string): string {
  return getPlatformPermission(key)?.name ?? key;
}
