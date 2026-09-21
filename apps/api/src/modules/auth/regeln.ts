/**
 * Reine Regeln der Anmeldung.
 *
 * Bewusst ohne Datenbank: Wie lange ein Konto nach dem wievielten Fehlversuch
 * wartet, ergibt sich vollständig aus der Zahl der Versuche. Zwischen Abfragen
 * versteckt wäre die Regel nur mit laufender Datenbank prüfbar.
 */

/** So viele Fehlversuche kosten nichts - Vertipper sollen niemanden aufhalten. */
export const FREIVERSUCHE = 4;

/** Wartezeit nach dem ersten kostenpflichtigen Fehlversuch. */
const BASIS_SEKUNDEN = 60;

/** Obergrenze der Wartezeit. */
const MAX_SEKUNDEN = 15 * 60;

/**
 * Wartezeit nach dem `versuche`-ten Fehlversuch, in Sekunden.
 *
 * **Warum nicht die flache Sperre von vorher.** Fünf Fehlversuche sperrten das
 * Konto pauschal eine Viertelstunde. Das begrenzt zwar das Raten, macht die
 * Sperre aber zur Waffe: Wer den Benutzernamen einer Kollegin kennt - und in
 * einem Haus kennt ihn jede:r -, konnte sie mit fünf falschen Eingaben alle
 * fünfzehn Minuten erneut aussperren. In einem Intranet, auf das vom Telefon
 * in der Halle zugegriffen wird, ist das ein echter Ausfall.
 *
 * Die wachsende Verzögerung dreht das Verhältnis um: Wer sich vertippt, ist
 * nach einer Minute wieder drin. Wer systematisch rät, steht nach acht
 * Versuchen bei einer Viertelstunde und schafft weniger als 30 Versuche am Tag.
 * Der Zähler geht bei erfolgreicher Anmeldung auf null - eine Sperre, die
 * jemand von außen erzeugt hat, ist damit nach einer richtigen Eingabe weg.
 */
export function sperrdauerSekunden(versuche: number): number {
  if (versuche <= FREIVERSUCHE) {
    return 0;
  }
  const stufe = versuche - FREIVERSUCHE - 1;
  return Math.min(MAX_SEKUNDEN, BASIS_SEKUNDEN * 2 ** stufe);
}

/** Zeitpunkt, bis zu dem das Konto wartet - oder `null`, wenn es nicht wartet. */
export function gesperrtBis(versuche: number, now: Date = new Date()): Date | null {
  const sekunden = sperrdauerSekunden(versuche);
  return sekunden === 0 ? null : new Date(now.getTime() + sekunden * 1000);
}
