/**
 * Prüfung der Haus-Kennung (Subdomain).
 *
 * Die Kennung ist der erste Namensteil der Adresse. Als Regel aus den Eingaben
 * gehört sie in eine reine Funktion: zwischen Datenbankabfragen versteckt
 * würde sie erst im Betrieb auffallen - als Haus, das nicht erreichbar ist.
 */

/**
 * Namen, die auf einem Server schon etwas anderes bedeuten. Ein Haus mit der
 * Kennung `localhub` bekäme von unserem Proxy nie sein Intranet zu sehen,
 * sondern die andere Anwendung; `www` und `api` kollidieren mit üblichen
 * Zuordnungen, `mail` und Verwandte mit dem Mailverkehr der Domain.
 */
export const RESERVIERTE_KENNUNGEN: ReadonlySet<string> = new Set([
  "www",
  "api",
  "app",
  "admin",
  "mail",
  "smtp",
  "imap",
  "pop",
  "ftp",
  "ns1",
  "ns2",
  "localhost",
  "landing",
  "localhub",
  "plattform",
  "verwaltung",
  "status",
]);

/** Liefert eine Fehlermeldung oder `null`, wenn die Kennung zulässig ist. */
export function pruefeKennung(roh: string): string | null {
  const kennung = roh.trim().toLowerCase();

  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(kennung)) {
    return "Die Kennung darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten, muss mit einem Buchstaben oder einer Ziffer beginnen und 2 bis 41 Zeichen lang sein.";
  }
  // Ein Namensteil einer Adresse darf nicht auf einen Bindestrich enden, und
  // "--" ist für internationalisierte Namen (xn--) belegt.
  if (kennung.endsWith("-") || kennung.includes("--")) {
    return "Die Kennung darf nicht mit einem Bindestrich enden und keine zwei Bindestriche hintereinander enthalten.";
  }
  if (RESERVIERTE_KENNUNGEN.has(kennung)) {
    return `Die Kennung "${kennung}" ist reserviert. Bitte eine andere wählen.`;
  }
  return null;
}
