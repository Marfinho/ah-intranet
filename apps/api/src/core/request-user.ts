import type { AppRole } from "@ah-intranet/shared";

/** Der aus dem JWT rekonstruierte Benutzer, der an jedem Request hängt. */
export interface RequestUser {
  id: string;
  /** Mandant der Sitzung. Der Datenzugriff filtert bereits darauf. */
  tenantId: string;
  username: string;
  displayName: string;
  /** Rolle mit dem höchsten Rang - nur für Anzeige, nie für Prüfungen. */
  role: AppRole;
  roles: AppRole[];
  permissions: string[];
  /** Zielgruppen-Tokens inklusive `global`. */
  scopes: string[];
  locationId: string | null;
  departmentId: string | null;
  tokenVersion: number;
  isPlatformAdmin?: boolean;
  /** Einzeln zugewiesene Rechte der Plattformverwaltung. */
  platformPermissions?: string[];
}

/**
 * Prüft ein Recht.
 *
 * Die einzige Frage, die der Fachcode über Befugnisse stellen darf. Ein
 * Rollenschlüssel sagt nichts: welche Rolle was darf, entscheidet jedes Haus
 * selbst, und eigene Rollen kennt der Code gar nicht.
 */
export function can(user: RequestUser, permission: string): boolean {
  return user.permissions.includes(permission);
}

/** Plattformadministration: darf Mandanten anlegen und sperren. */
export function isPlatformAdmin(user: RequestUser): boolean {
  return user.isPlatformAdmin === true;
}

/**
 * Prüft ein Recht der Plattformverwaltung.
 *
 * `isPlatformAdmin` erfüllt jede Prüfung zusätzlich - der Betreiber braucht
 * keine Einzelfreischaltung für Aufgaben, die er ohnehin anlegen darf.
 */
export function hasPlatformPermission(user: RequestUser, permission: string): boolean {
  return isPlatformAdmin(user) || (user.platformPermissions ?? []).includes(permission);
}
