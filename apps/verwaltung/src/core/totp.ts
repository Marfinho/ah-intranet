// Bewusste Kopie von apps/api/src/core: die Verwaltung baut und läuft ohne Abhängigkeit vom Kundendienst.
// Änderungen an der Sicherheitslogik bitte an beiden Stellen vornehmen; die Tests sind dieselben.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Zeitbasierte Einmalcodes nach RFC 6238 (TOTP), SHA-1, sechs Stellen, 30 s.
 *
 * Selbst geschrieben statt als Bibliothek: es sind dreißig Zeilen, die gegen
 * die Testvektoren der RFC prüfbar sind, und eine Abhängigkeit weniger in der
 * Lieferkette an der Stelle, an der die Anmeldung hängt. SHA-1 ist hier kein
 * Mangel - HMAC-SHA1 gilt weiterhin als sicher, und gerade diese Parameter
 * beherrschen alle gängigen Authenticator-Apps.
 */
const SCHRITT_SEKUNDEN = 30;
const STELLEN = 6;
/** Eine Periode Abweichung der Uhr nach beiden Seiten. */
const TOLERANZ = 1;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Kodieren(daten: Buffer): string {
  let bits = 0;
  let wert = 0;
  let ergebnis = "";
  for (const byte of daten) {
    wert = (wert << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      ergebnis += BASE32[(wert >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    ergebnis += BASE32[(wert << (5 - bits)) & 31];
  }
  return ergebnis;
}

export function base32Dekodieren(text: string): Buffer {
  let bits = 0;
  let wert = 0;
  const bytes: number[] = [];
  for (const zeichen of text.replace(/[\s=]/g, "").toUpperCase()) {
    const index = BASE32.indexOf(zeichen);
    if (index < 0) {
      throw new Error("Kein gültiges Base32-Zeichen.");
    }
    wert = (wert << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((wert >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160 Bit Zufall, so lang wie der Schlüssel der HMAC-Funktion. */
export function neuesTotpGeheimnis(): string {
  return base32Kodieren(randomBytes(20));
}

export function zeitschritt(zeitpunkt: number = Date.now()): number {
  return Math.floor(zeitpunkt / 1000 / SCHRITT_SEKUNDEN);
}

export function totpCode(geheimnis: string, schritt: number, stellen: number = STELLEN): string {
  const zaehler = Buffer.alloc(8);
  zaehler.writeBigUInt64BE(BigInt(schritt));
  const hmac = createHmac("sha1", base32Dekodieren(geheimnis)).update(zaehler).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const zahl =
    ((hmac[offset]! & 0x7f) << 24) | (hmac[offset + 1]! << 16) | (hmac[offset + 2]! << 8) | hmac[offset + 3]!;
  return String(zahl % 10 ** stellen).padStart(stellen, "0");
}

/**
 * Prüft einen Code und liefert den Zeitschritt, in dem er galt - oder `null`.
 *
 * `zuletztVerbraucht` ist der letzte schon akzeptierte Schritt: ein Code, der
 * einmal angenommen wurde, gilt nicht noch einmal, sonst reichte einem
 * Angreifer, der ihn beim Eintippen mitliest, die Restlaufzeit.
 */
export function pruefeTotp(
  geheimnis: string,
  eingabe: string,
  zuletztVerbraucht: number | null = null,
  zeitpunkt: number = Date.now(),
): number | null {
  const bereinigt = eingabe.replace(/\s/g, "");
  if (!/^\d{6}$/.test(bereinigt)) {
    return null;
  }
  const aktuell = zeitschritt(zeitpunkt);
  let treffer: number | null = null;
  // Alle Kandidaten durchlaufen, auch nach einem Treffer: die Laufzeit soll
  // nicht verraten, in welcher Periode der Code lag.
  for (let schritt = aktuell - TOLERANZ; schritt <= aktuell + TOLERANZ; schritt++) {
    const erwartet = Buffer.from(totpCode(geheimnis, schritt));
    if (
      timingSafeEqual(erwartet, Buffer.from(bereinigt)) &&
      (zuletztVerbraucht === null || schritt > zuletztVerbraucht)
    ) {
      treffer = schritt;
    }
  }
  return treffer;
}

/** Adresse für den QR-Code; Authenticator-Apps lesen dieses Format. */
export function totpAdresse(geheimnis: string, konto: string, aussteller: string): string {
  const bezeichnung = encodeURIComponent(`${aussteller}:${konto}`);
  const parameter = new URLSearchParams({
    secret: geheimnis,
    issuer: aussteller,
    algorithm: "SHA1",
    digits: String(STELLEN),
    period: String(SCHRITT_SEKUNDEN),
  });
  return `otpauth://totp/${bezeichnung}?${parameter.toString()}`;
}

const ANZAHL_WIEDERHERSTELLUNGSCODES = 10;

/** Einmalcodes für den Fall, dass das Telefon weg ist: `xxxx-xxxx` aus Ziffern und Buchstaben ohne Verwechslungen. */
export function neueWiederherstellungscodes(): string[] {
  const zeichen = "abcdefghjkmnpqrstuvwxyz23456789";
  const einer = () => Array.from(randomBytes(4), (byte) => zeichen[byte % zeichen.length]).join("");
  return Array.from({ length: ANZAHL_WIEDERHERSTELLUNGSCODES }, () => `${einer()}-${einer()}`);
}

/**
 * Ein schneller Hash genügt: die Codes tragen 40 Bit Zufall und gelten einmal;
 * ein langsamer Hash schützte Passwörter mit wenig Entropie, nicht dies.
 */
export function hashWiederherstellungscode(code: string): string {
  return createHash("sha256").update(code.replace(/[\s-]/g, "").toLowerCase()).digest("hex");
}
