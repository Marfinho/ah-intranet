import { randomInt } from "node:crypto";

/**
 * Erzeugt Startpasswörter für neue und zurückgesetzte Konten.
 *
 * Bewusst `crypto.randomInt` und nicht `Math.random()`: dessen Generator ist
 * xorshift128+ und aus wenigen beobachteten Ausgaben rekonstruierbar. Jeder,
 * der ein selbst erzeugtes Startpasswort kennt - und das ist jede Person, für
 * die je ein Konto angelegt wurde -, könnte damit die Passwörter vorhersagen,
 * die derselbe Prozess davor und danach vergeben hat.
 *
 * Das Alphabet lässt verwechselbare Zeichen (0/O, 1/l/I) weg: das Passwort wird
 * am Telefon durchgegeben und von Hand abgetippt.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Zeichen ohne das Ausrufezeichen am Ende; 14 Zeichen aus diesem Alphabet sind rund 83 Bit. */
const LAENGE = 14;

export function erzeugeStartpasswort(): string {
  const zeichen = Array.from({ length: LAENGE }, () => ALPHABET[randomInt(ALPHABET.length)]);
  // Das Ausrufezeichen erfüllt Komplexitätsregeln, die manche Häuser erwarten,
  // ohne die Entropie der übrigen Stellen zu verringern.
  return `${zeichen.join("")}!`;
}

export { ALPHABET as PASSWORT_ALPHABET, LAENGE as PASSWORT_LAENGE };
