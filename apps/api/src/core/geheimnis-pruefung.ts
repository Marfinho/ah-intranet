/**
 * Prüft beim Start, ob die Geheimnisse einer Produktivinstallation taugen.
 *
 * Eine reine Funktion über die Umgebung: Mit dem Platzhalter aus der
 * Beispieldatei wäre jede Sitzung fälschbar, wer ihn kennt (er steht im
 * Repository), kann sich als beliebiges Konto ausweisen. Gefährlich ist das
 * gerade, weil nichts davon sichtbar scheitert - die Anmeldung funktioniert.
 *
 * Nur bei NODE_ENV=production: In der Entwicklung sind die Platzhalter gewollt.
 */

const MINDESTLAENGE = 32;
const PLATZHALTER = /bitte-aendern|changeme|change-me|geheim|secret|passwort|password|beispiel|example|test/i;

function schwach(wert: string): boolean {
  return wert.length < MINDESTLAENGE || PLATZHALTER.test(wert);
}

export function pruefeGeheimnisse(env: Record<string, string | undefined>): string[] {
  if (env.NODE_ENV !== "production") {
    return [];
  }

  const probleme: string[] = [];
  const jwt = env.JWT_SECRET;
  if (!jwt) {
    probleme.push("JWT_SECRET fehlt.");
  } else if (schwach(jwt)) {
    probleme.push(`JWT_SECRET ist ein Platzhalter oder kürzer als ${MINDESTLAENGE} Zeichen.`);
  }

  // Ohne SECRET_KEY startet die Anwendung - sie speichert dann nur keine
  // Geheimnisse (siehe geheimnis.ts). Ist er aber gesetzt, muss er taugen.
  const schluessel = env.SECRET_KEY;
  if (schluessel && schwach(schluessel)) {
    probleme.push(`SECRET_KEY ist ein Platzhalter oder kürzer als ${MINDESTLAENGE} Zeichen.`);
  }

  return probleme;
}
