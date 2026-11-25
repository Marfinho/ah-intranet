import { ExecutionContext, SetMetadata, createParamDecorator } from "@nestjs/common";
import type { RequestUser } from "./request-user";

export const PUBLIC_KEY = "auth:public";
export const PERMISSION_KEY = "auth:permission";
export const FEATURE_KEY = "feature:module";
export const PLATFORM_ADMIN_KEY = "auth:platform-admin";
export const MFA_EINRICHTUNG_KEY = "auth:mfa-einrichtung";

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
 * Lässt die Route auch zu, solange der zweite Faktor noch einzurichten ist.
 *
 * Verlangt ein Haus (oder die Plattformverwaltung) den zweiten Faktor, kommt ein
 * Konto ohne ihn nur an Einrichtung, Abmeldung und die eigene Sitzungsauskunft
 * heran - alles andere antwortet mit 403. Die Anmeldung gelingt trotzdem, sonst
 * käme niemand je zur Einrichtung.
 */
export const MfaEinrichtung = () => SetMetadata(MFA_EINRICHTUNG_KEY, true);

/**
 * Bindet Controller oder Route an ein Modul der Registry. Ist das Modul
 * deaktiviert, antwortet die API mit 404 statt die Route zu bedienen.
 */
export const Feature = (moduleKey: string) => SetMetadata(FEATURE_KEY, moduleKey);

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): RequestUser => {
  return context.switchToHttp().getRequest().user as RequestUser;
});
