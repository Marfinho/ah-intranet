import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Verschlüsselt Geheimnisse, bevor sie in die Datenbank gehen.
 *
 * Betrifft Zugangsdaten, die das Haus hinterlegt - etwa den Clientschlüssel
 * seines Identitätsanbieters. Ein Datenbankabzug soll sie nicht mitliefern.
 *
 * AES-256-GCM mit zufälligem Nonce je Wert; das Authentifizierungsetikett
 * steht mit im Speicherformat, ein verändertes Geheimnis fliegt beim
 * Entschlüsseln auf statt stillschweigend Unsinn zu liefern.
 *
 * Der Schlüssel kommt aus `SECRET_KEY`. Fehlt er, wird nichts verschlüsselt -
 * und nichts gespeichert: lieber eine klare Absage als ein Klartextgeheimnis.
 */
const ALGORITHMUS = "aes-256-gcm";
const SALZ = "ahoi-geheimnis-v1";

export class GeheimnisFehltError extends Error {
  constructor() {
    super("SECRET_KEY ist nicht gesetzt - Geheimnisse können nicht verschlüsselt gespeichert werden.");
  }
}

function schluessel(): Buffer {
  const roh = process.env.SECRET_KEY;
  if (!roh) {
    throw new GeheimnisFehltError();
  }
  return scryptSync(roh, SALZ, 32);
}

export function istVerschluesselungMoeglich(): boolean {
  return Boolean(process.env.SECRET_KEY);
}

/** Speicherformat: `nonce:etikett:chiffrat`, alles hexadezimal. */
export function verschluessele(klartext: string): string {
  const nonce = randomBytes(12);
  const chiffre = createCipheriv(ALGORITHMUS, schluessel(), nonce);
  const chiffrat = Buffer.concat([chiffre.update(klartext, "utf8"), chiffre.final()]);
  return [nonce.toString("hex"), chiffre.getAuthTag().toString("hex"), chiffrat.toString("hex")].join(":");
}

export function entschluessele(gespeichert: string): string {
  const [nonce, etikett, chiffrat] = gespeichert.split(":");
  if (!nonce || !etikett || !chiffrat) {
    throw new Error("Das gespeicherte Geheimnis hat kein gültiges Format.");
  }
  const chiffre = createDecipheriv(ALGORITHMUS, schluessel(), Buffer.from(nonce, "hex"));
  chiffre.setAuthTag(Buffer.from(etikett, "hex"));
  return Buffer.concat([chiffre.update(Buffer.from(chiffrat, "hex")), chiffre.final()]).toString("utf8");
}
