import { ExecutionContext, SetMetadata, createParamDecorator } from "@nestjs/common";
import type { AppRole } from "@ah-intranet/shared";
import type { RequestUser } from "./request-user";

export const PUBLIC_KEY = "auth:public";
export const ROLES_KEY = "auth:roles";
export const PERMISSION_KEY = "auth:permission";
export const FEATURE_KEY = "feature:module";
export const PLATFORM_ADMIN_KEY = "auth:platform-admin";

/** Hebt die global aktive JWT-Prüfung für einzelne Routen auf (Login, Health). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Beschränkt eine Route auf die angegebenen Rollen. */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Verlangt ein benanntes Recht aus `packages/shared/src/rbac.ts`.
 *
 * Ergänzt `@Roles` und ersetzt es nicht: Die Rolle sagt, wer grundsätzlich in
 * diesen Bereich gehört, das Recht sagt, was davon ein Haus der Rolle
 * tatsächlich zugesteht. Ohne dieses Merkmal wäre der Rechte-Editor Zierde -
 * er vergäbe Berechtigungen, die niemand prüft.
 */
export const Permission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);

/**
 * Beschränkt eine Route auf die Plattformverwaltung.
 *
 * Bewusst getrennt von der Rolle `admin`: die verwaltet das eigene Haus. Wer
 * Mandanten anlegen oder abschalten darf, ist eine Entscheidung des Betreibers
 * und darf nicht aus dem Haus heraus vergeben werden können.
 */
export const PlatformAdmin = () => SetMetadata(PLATFORM_ADMIN_KEY, true);

/**
 * Bindet Controller oder Route an ein Modul der Registry. Ist das Modul
 * deaktiviert, antwortet die API mit 404 statt die Route zu bedienen.
 */
export const Feature = (moduleKey: string) => SetMetadata(FEATURE_KEY, moduleKey);

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): RequestUser => {
  return context.switchToHttp().getRequest().user as RequestUser;
});
