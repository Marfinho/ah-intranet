import type { AppRole } from "@ah-intranet/shared";

/** Der aus dem JWT rekonstruierte Benutzer, der an jedem Request hängt. */
export interface RequestUser {
  id: string;
  username: string;
  displayName: string;
  role: AppRole;
  roles: AppRole[];
  permissions: string[];
  /** Zielgruppen-Tokens inklusive `global`. */
  scopes: string[];
  locationId: string | null;
  departmentId: string | null;
}

export function hasRole(user: RequestUser, ...roles: AppRole[]): boolean {
  return roles.some((role) => user.roles.includes(role));
}

export function isAdmin(user: RequestUser): boolean {
  return hasRole(user, "admin");
}

/** Admins und Fachbereichsadmins dürfen fremde Vorgänge sehen und steuern. */
export function isManaging(user: RequestUser): boolean {
  return hasRole(user, "admin", "fachbereichsadmin");
}
