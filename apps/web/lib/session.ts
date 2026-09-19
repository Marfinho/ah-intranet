import { cache } from "react";
import { redirect } from "next/navigation";
import type { ModuleState, SessionUser } from "@ah-intranet/shared";
import { ApiError, apiGet } from "./api";

/**
 * Sitzung und Modulzustand werden pro Request genau einmal geladen - `cache`
 * dedupliziert die Aufrufe über alle Server Components eines Renders hinweg.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  try {
    return await apiGet<SessionUser>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && (error.isAuthError || error.status === 403)) {
      return null;
    }
    throw error;
  }
});

export const getModules = cache(async (): Promise<ModuleState[]> => {
  try {
    return await apiGet<ModuleState[]>("/modules");
  } catch {
    return [];
  }
});

export const getUnreadCount = cache(async (): Promise<number> => {
  try {
    const result = await apiGet<{ unread: number }>("/notifications/count");
    return result.unread;
  } catch {
    return 0;
  }
});

/** Für Seiten, die zwingend eine Anmeldung brauchen. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Stellt sicher, dass ein Modul aktiv ist. Abgeschaltete Module verhalten sich
 * im Frontend wie nicht vorhandene Seiten.
 */
export async function requireModule(key: string): Promise<SessionUser> {
  const session = await requireSession();
  const modules = await getModules();
  const module = modules.find((entry) => entry.key === key);
  if (module && !module.enabled) {
    redirect("/modul-deaktiviert?m=" + encodeURIComponent(key));
  }
  return session;
}

/**
 * Sperrt eine Seite, solange keines der genannten Rechte vorliegt.
 *
 * Bewusst Rechte statt Rollen: welche Rolle was darf, entscheidet jedes Haus
 * selbst. Das ist Bequemlichkeit, keine Sicherheit - durchgesetzt wird in der
 * API. Die Seite soll nur nicht halbleer erscheinen.
 */
export async function requirePermission(...permissions: string[]): Promise<SessionUser> {
  const session = await requireSession();
  if (!permissions.some((permission) => session.permissions.includes(permission))) {
    redirect("/");
  }
  return session;
}

export function can(session: SessionUser, permission: string): boolean {
  return session.permissions.includes(permission);
}
