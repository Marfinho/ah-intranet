import { ExecutionContext, SetMetadata, createParamDecorator } from "@nestjs/common";
import type { RequestUser } from "./request-user";

export const PUBLIC_KEY = "auth:public";
export const PERMISSION_KEY = "auth:permission";
export const FEATURE_KEY = "feature:module";
export const PLATFORM_ADMIN_KEY = "auth:platform-admin";
export const PLATFORM_PERMISSION_KEY = "auth:platform-permission";

/** Hebt die global aktive JWT-Prüfung für einzelne Routen auf (Login, Health). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/**
 * Verlangt ein benanntes Recht aus `packages/shared/src/rbac.ts`.
 *
 * Das einzige Merkmal, das eine Route absichert. Rollenschlüssel taugen dafür
 * nicht: welche Rolle was darf, entscheidet jedes Haus selbst, und eigene
 * Rollen kennt der Code gar nicht. Eine Route, die kein Recht trägt, steht
 * jedem angemeldeten Konto offen - das ist eine Aussage, keine Lücke.
 */
export const Permission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);

/**
 * Beschränkt eine Route auf die Plattformverwaltung.
 *
 * Bewusst getrennt von den Rechten des Hauses: die verwalten das eigene Haus. Wer
 * Mandanten anlegen oder abschalten darf, ist eine Entscheidung des Betreibers
 * und darf nicht aus dem Haus heraus vergeben werden können.
 */
export const PlatformAdmin = () => SetMetadata(PLATFORM_ADMIN_KEY, true);

/**
 * Verlangt ein einzeln zugewiesenes Recht der Plattformverwaltung, z. B. den
 * Support-Posteingang.
 *
 * Anders als `@PlatformAdmin()` nicht auf den Betreiber selbst beschränkt:
 * Mitarbeitende, die den Service machen, bekommen genau die Rechte, die sie
 * brauchen, ohne Mandanten anlegen zu dürfen. `isPlatformAdmin` erfüllt jede
 * Prüfung dieser Art zusätzlich - der Betreiber braucht keine Einzelfreischaltung.
 */
export const PlatformPermission = (permission: string) => SetMetadata(PLATFORM_PERMISSION_KEY, permission);

/**
 * Bindet Controller oder Route an ein Modul der Registry. Ist das Modul
 * deaktiviert, antwortet die API mit 404 statt die Route zu bedienen.
 */
export const Feature = (moduleKey: string) => SetMetadata(FEATURE_KEY, moduleKey);

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): RequestUser => {
  return context.switchToHttp().getRequest().user as RequestUser;
});
