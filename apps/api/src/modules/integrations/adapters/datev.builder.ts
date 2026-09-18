/**
 * Erzeugt einen DATEV-Buchungsstapel im EXTF-Format.
 *
 * Aufbau nach der öffentlichen Formatbeschreibung der DATEV
 * (https://developer.datev.de/de/file-format/details/datev-format/format-description/booking-batch):
 * Zeile 1 Kopfsatz mit 31 Feldern, Zeile 2 die Spaltenüberschriften,
 * ab Zeile 3 die Buchungssätze. Trennzeichen ist das Semikolon, Texte stehen
 * in Anführungszeichen, Beträge werden mit Dezimalkomma geschrieben.
 *
 * Bewusst als reine Funktion ohne Datenbank- oder Netzzugriff gehalten, damit
 * sich das Format isoliert prüfen lässt.
 */

/** Spaltenüberschriften des Buchungsstapels, Formatversion 13. */
export const DATEV_COLUMNS = [
  "Umsatz (ohne Soll/Haben-Kz)",
  "Soll/Haben-Kennzeichen",
  "WKZ Umsatz",
  "Kurs",
  "Basisumsatz",
  "WKZ Basisumsatz",
  "Konto",
  "Gegenkonto (ohne BU-Schlüssel)",
  "BU-Schlüssel",
  "Belegdatum",
  "Belegfeld 1",
  "Belegfeld 2",
  "Skonto",
  "Buchungstext",
  "Postensperre",
  "Diverse Adressnummer",
  "Geschäftspartnerbank",
  "Sachverhalt",
  "Zinssperre",
  "Beleglink",
  "Beleginfo – Art 1",
  "Beleginfo – Inhalt 1",
  "Beleginfo – Art 2",
  "Beleginfo – Inhalt 2",
  "Beleginfo – Art 3",
  "Beleginfo – Inhalt 3",
  "Beleginfo – Art 4",
  "Beleginfo – Inhalt 4",
  "Beleginfo – Art 5",
  "Beleginfo – Inhalt 5",
  "Beleginfo – Art 6",
  "Beleginfo – Inhalt 6",
  "Beleginfo – Art 7",
  "Beleginfo – Inhalt 7",
  "Beleginfo – Art 8",
  "Beleginfo – Inhalt 8",
  "KOST1 – Kostenstelle",
  "KOST2 – Kostenstelle",
  "Kost Menge",
  "EU-Land u. USt-IdNr.",
  "EU-Steuersatz",
  "Abw. Versteuerungsart",
  "Sachverhalt L+L",
  "Funktionsergänzung L+L",
  "BU 49 Hauptfunktionstyp",
  "BU 49 Hauptfunktionsnummer",
  "BU 49 Funktionsergänzung",
  "Zusatzinformation – Art 1",
  "Zusatzinformation – Inhalt 1",
  "Zusatzinformation – Art 2",
  "Zusatzinformation – Inhalt 2",
  "Zusatzinformation – Art 3",
  "Zusatzinformation – Inhalt 3",
  "Zusatzinformation – Art 4",
  "Zusatzinformation – Inhalt 4",
  "Zusatzinformation – Art 5",
  "Zusatzinformation – Inhalt 5",
  "Zusatzinformation – Art 6",
  "Zusatzinformation – Inhalt 6",
  "Zusatzinformation – Art 7",
  "Zusatzinformation – Inhalt 7",
  "Zusatzinformation – Art 8",
  "Zusatzinformation – Inhalt 8",
  "Zusatzinformation – Art 9",
  "Zusatzinformation – Inhalt 9",
  "Zusatzinformation – Art 10",
  "Zusatzinformation – Inhalt 10",
  "Zusatzinformation – Art 11",
  "Zusatzinformation – Inhalt 11",
  "Zusatzinformation – Art 12",
  "Zusatzinformation – Inhalt 12",
  "Zusatzinformation – Art 13",
  "Zusatzinformation – Inhalt 13",
  "Zusatzinformation – Art 14",
  "Zusatzinformation – Inhalt 14",
  "Zusatzinformation – Art 15",
  "Zusatzinformation – Inhalt 15",
  "Zusatzinformation – Art 16",
  "Zusatzinformation – Inhalt 16",
  "Zusatzinformation – Art 17",
  "Zusatzinformation – Inhalt 17",
  "Zusatzinformation – Art 18",
  "Zusatzinformation – Inhalt 18",
  "Zusatzinformation – Art 19",
  "Zusatzinformation – Inhalt 19",
  "Zusatzinformation – Art 20",
  "Zusatzinformation – Inhalt 20",
  "Stück",
  "Gewicht",
  "Zahlweise",
  "Forderungsart",
  "Veranlagungsjahr",
  "Zugeordnete Fälligkeit",
  "Skontotyp",
  "Auftragsnummer",
  "Buchungstyp",
  "USt-Schlüssel (Anzahlungen)",
  "EU-Mitgliedstaat (Anzahlungen)",
  "Sachverhalt L+L (Anzahlungen)",
  "EU-Steuersatz (Anzahlungen)",
  "Erlöskonto (Anzahlungen)",
  "Herkunft-Kz",
  "Leerfeld",
  "KOST-Datum",
  "SEPA-Mandatsreferenz",
  "Skontosperre",
  "Gesellschaftername",
  "Beteiligtennummer",
  "Identifikationsnummer",
  "Zeichnernummer",
  "Postensperre bis",
  "Bezeichnung",
  "Kennzeichen",
  "Festschreibung",
  "Leistungsdatum",
  "Datum Zuord.",
  "Fälligkeit",
  "Generalumkehr",
  "Steuersatz",
  "Land",
  "Abrechnungsreferent",
  "BVV-Position",
  "EU-Mitgliedstaat u. UStID (Ursprung)",
  "EU-Steuersatz (Ursprung)",
  "Abw. Skontokonto",
] as const;

export interface DatevHeaderOptions {
  consultantNumber: number;
  clientNumber: number;
  /** Beginn des Wirtschaftsjahres als TTMM, Standard 0101. */
  fiscalStart?: string;
  accountLength?: number;
  from: Date;
  to: Date;
  description: string;
  /** Wer den Stapel erzeugt hat - erscheint im Kopfsatz. */
  exportedBy: string;
  generatedAt?: Date;
}

export interface DatevBooking {
  /** Betrag ohne Vorzeichen; die Richtung steckt im Soll/Haben-Kennzeichen. */
  amount: number;
  debitCredit: "S" | "H";
  /** Sachkonto (Soll bei "S"). */
  account: string;
  counterAccount: string;
  buKey?: string;
  date: Date;
  /** Belegfeld 1, üblicherweise die Rechnungs- oder Vorgangsnummer. */
  documentField1?: string;
  text: string;
}

function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** DATEV erwartet das Dezimalkomma und keine Tausenderpunkte. */
function amount(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/** Belegdatum im Stapel ist TTMM - das Jahr steckt im Kopfsatz. */
function dayMonth(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}${month}`;
}

function isoDay(date: Date): string {
  return (
    `${date.getUTCFullYear()}` +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    String(date.getUTCDate()).padStart(2, "0")
  );
}

function timestamp(date: Date): string {
  return (
    isoDay(date) +
    String(date.getUTCHours()).padStart(2, "0") +
    String(date.getUTCMinutes()).padStart(2, "0") +
    String(date.getUTCSeconds()).padStart(2, "0") +
    String(date.getUTCMilliseconds()).padStart(3, "0")
  );
}

/**
 * Kürzt und bereinigt Buchungstexte: DATEV erlaubt 60 Zeichen und keine
 * Semikola oder Zeilenumbrüche im Feld.
 */
export function sanitiseText(value: string, maxLength = 60): string {
  return value
    .replace(/[\r\n;]+/g, " ")
    .replace(/€/g, "EUR")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function buildHeader(options: DatevHeaderOptions, bookingYearStart: string): string {
  const fields: (string | number)[] = [
    quote("EXTF"),
    700,
    21,
    quote("Buchungsstapel"),
    13,
    timestamp(options.generatedAt ?? new Date()),
    "", // importiert am
    quote("AH"), // Herkunftskennzeichen
    quote(sanitiseText(options.exportedBy, 25)),
    "", // importiert von
    options.consultantNumber,
    options.clientNumber,
    bookingYearStart,
    options.accountLength ?? 4,
    isoDay(options.from),
    isoDay(options.to),
    quote(sanitiseText(options.description, 30)),
    "", // Diktatkürzel
    1, // Buchungstyp: Finanzbuchführung
    "", // Rechnungslegungszweck
    0, // Festschreibung: nein, die Kanzlei entscheidet
    quote("EUR"),
  ];

  // Der Kopfsatz hat 31 Felder; der Rest bleibt leer.
  while (fields.length < 31) {
    fields.push("");
  }
  return fields.join(";");
}

export function buildBuchungsstapel(bookings: DatevBooking[], options: DatevHeaderOptions): string {
  const fiscalStart = (options.fiscalStart ?? "0101").padStart(4, "0");
  const year = options.from.getUTCFullYear();
  const bookingYearStart = `${year}${fiscalStart.slice(2, 4)}${fiscalStart.slice(0, 2)}`;

  const lines = [buildHeader(options, bookingYearStart), DATEV_COLUMNS.join(";")];

  for (const booking of bookings) {
    const row: string[] = [
      amount(Math.abs(booking.amount)),
      quote(booking.debitCredit),
      "", // WKZ Umsatz
      "", // Kurs
      "", // Basisumsatz
      "", // WKZ Basisumsatz
      booking.account,
      booking.counterAccount,
      booking.buKey ? quote(booking.buKey) : "",
      dayMonth(booking.date),
      booking.documentField1 ? quote(sanitiseText(booking.documentField1, 36)) : "",
      "", // Belegfeld 2
      "", // Skonto
      quote(sanitiseText(booking.text)),
    ];

    while (row.length < DATEV_COLUMNS.length) {
      row.push("");
    }
    lines.push(row.join(";"));
  }

  // DATEV erwartet CRLF und eine abschließende Leerzeile.
  return lines.join("\r\n") + "\r\n";
}

/**
 * DATEV liest die Datei als Windows-1252. Node kennt diese Kodierung nicht
 * direkt; latin1 deckt den deutschen Zeichenvorrat ab, die wenigen
 * abweichenden Zeichen werden vorher ersetzt.
 */
export function toDatevBuffer(content: string): Buffer {
  return Buffer.from(content.replace(/€/g, "EUR").replace(/[“”]/g, '"').replace(/[–—]/g, "-"), "latin1");
}

/** Dateiname nach DATEV-Konvention. */
export function datevFileName(from: Date, to: Date): string {
  return `EXTF_Buchungsstapel_${isoDay(from)}_${isoDay(to)}.csv`;
}
