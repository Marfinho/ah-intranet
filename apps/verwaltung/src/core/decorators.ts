import { ExecutionContext, SetMetadata, createParamDecorator } from "@nestjs/common";

export const PUBLIC_KEY = "auth:public";
export const SCHREIBEND_KEY = "auth:schreibend";
export const MFA_EINRICHTUNG_KEY = "auth:mfa-einrichtung";

/** Ohne Anmeldung erreichbar (Anmeldung, Health). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Ändert Daten: nur Betreiber mit der Rolle `inhaber`. Lesende bekommen 403. */
export const Schreibend = () => SetMetadata(SCHREIBEND_KEY, true);

/** Auch erreichbar, solange der zweite Faktor noch einzurichten ist. */
export const MfaEinrichtung = () => SetMetadata(MFA_EINRICHTUNG_KEY, true);

export interface Sitzung {
  id: string;
  username: string;
  displayName: string;
  rolle: "inhaber" | "lesend";
}

export const Aktuell = createParamDecorator((_daten: unknown, context: ExecutionContext): Sitzung => {
  return context.switchToHttp().getRequest<{ betreiber: Sitzung }>().betreiber;
});
