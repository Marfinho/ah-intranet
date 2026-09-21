import type { AppRole, Presence } from "@ah-intranet/shared";
import { GLOBAL_SCOPE, eigeneZielgruppen } from "@ah-intranet/shared";
import type { RequestUser } from "./request-user";

/** Minimale Benutzerfelder, die für Anzeigezwecke überall selektiert werden. */
export const userDisplaySelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
} as const;

export interface DisplayableUser {
  firstName: string;
  lastName: string;
}

export function displayName(user: DisplayableUser | null | undefined): string {
  return user ? `${user.firstName} ${user.lastName}`.trim() : "Unbekannt";
}

export const PRESENCE_LABELS: Record<string, Presence> = {
  vor_ort: "vor Ort",
  mobil: "mobil",
  abwesend: "abwesend",
};

export const PRESENCE_VALUES: Record<Presence, "vor_ort" | "mobil" | "abwesend"> = {
  "vor Ort": "vor_ort",
  mobil: "mobil",
  abwesend: "abwesend",
};

/**
 * Die Zielgruppen-Tokens eines Kontos. Aufbau und Kaskade stehen in
 * `@ah-intranet/shared`; hier bleibt nur der Aufruf, damit Sitzung,
 * Benutzerpflege und Mandantenanlage dieselbe Wahrheit benutzen.
 */
export function buildScopes(input: {
  locationCode?: string | null;
  departmentCode?: string | null;
  specialtyCode?: string | null;
}): string[] {
  return eigeneZielgruppen(input);
}

/** Prisma-Filterfragment für zielgruppengesteuerte Inhalte. */
export function audienceFilter(user: RequestUser) {
  return { audienceScopes: { hasSome: user.scopes.length ? user.scopes : [GLOBAL_SCOPE] } };
}

export function scopeLabel(input: {
  location?: { name: string } | null;
  department?: { name: string } | null;
  specialtyArea?: { name: string } | null;
}): string {
  return (
    [input.location?.name, input.department?.name, input.specialtyArea?.name].filter(Boolean).join(" · ") ||
    "Gesamtes Unternehmen"
  );
}

/** Eine Rolle, so wie die Anzeige sie braucht: Schlüssel, Name, Rangfolge. */
export interface RollenAnzeige {
  key: AppRole;
  name: string;
  rank: number;
}

/**
 * Rollen nach Rangfolge, höchste zuerst.
 *
 * Die Rangfolge steht am Datensatz, nicht im Code: welche Rolle über welcher
 * steht, entscheidet jedes Haus selbst. Bei Gleichstand entscheidet der Name,
 * damit die Reihenfolge stabil bleibt.
 */
export function sortiereRollen(roles: RollenAnzeige[]): RollenAnzeige[] {
  return [...roles].sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name, "de"));
}

/** Höchste Rolle nach Rangfolge; bestimmt die angezeigte Hauptrolle. */
export function primaryRole(roles: RollenAnzeige[]): AppRole {
  return sortiereRollen(roles)[0]?.key ?? "mitarbeiter";
}

export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/** Fortlaufende, menschenlesbare Vorgangsnummer. */
export function buildNumber(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(5, "0")}`;
}

/** Arbeitstage zwischen zwei Daten (inklusive), Wochenenden ausgenommen. */
export function workingDaysBetween(start: Date, end: Date): number {
  let days = 0;
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  while (cursor.getTime() <= last) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      days += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
