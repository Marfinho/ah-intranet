// Bewusste Kopie von apps/api/src/modules/platform/pitch-regeln.ts: die Pitch-Seite der Kunden-Anwendung prüft denselben Hash.
// Ändert sich das Verfahren, muss es an beiden Stellen geschehen; der Test ist derselbe.
import { createHash, randomBytes } from "node:crypto";

/**
 * Regeln des Pitch-Links als reine Funktionen: Token, Hash, Gültigkeit.
 * Die Vorschlagsregeln für die Häuser liegen im gemeinsamen Paket, weil auch
 * der Browser sie braucht (`packages/shared/src/pitch-vorschlag.ts`).
 */

/* ------------------------------------------------------------------- Link */

/** Zufälliger Link-Bestandteil. 256 Bit, nicht erratbar. */
export function neuesToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Nur der Hash liegt in der Datenbank: ein Datenbankabzug öffnet keine Pitch-Seite. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const LINK_TAGE_STANDARD = 60;
export const LINK_TAGE_MAX = 365;

export function linkGueltigBis(tage: number, jetzt: Date = new Date()): Date {
  const begrenzt = Math.min(LINK_TAGE_MAX, Math.max(1, Math.floor(tage)));
  return new Date(jetzt.getTime() + begrenzt * 24 * 60 * 60 * 1000);
}

export function linkIstGueltig(
  lead: { tokenGueltigBis: Date; tokenWiderrufenAm: Date | null },
  jetzt: Date = new Date(),
) {
  return lead.tokenWiderrufenAm === null && lead.tokenGueltigBis.getTime() > jetzt.getTime();
}
