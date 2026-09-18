import { ExecutionContext, SetMetadata, createParamDecorator } from "@nestjs/common";
import type { AppRole } from "@ah-intranet/shared";
import type { RequestUser } from "./request-user";

export const PUBLIC_KEY = "auth:public";
export const ROLES_KEY = "auth:roles";
export const FEATURE_KEY = "feature:module";

/** Hebt die global aktive JWT-Prüfung für einzelne Routen auf (Login, Health). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Beschränkt eine Route auf die angegebenen Rollen. */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Bindet Controller oder Route an ein Modul der Registry. Ist das Modul
 * deaktiviert, antwortet die API mit 404 statt die Route zu bedienen.
 */
export const Feature = (moduleKey: string) => SetMetadata(FEATURE_KEY, moduleKey);

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): RequestUser => {
  return context.switchToHttp().getRequest().user as RequestUser;
});
