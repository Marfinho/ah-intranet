import { describe, expect, it } from "vitest";
import {
  DATEV_COLUMNS,
  buildBuchungsstapel,
  datevFileName,
  sanitiseText,
  toDatevBuffer,
  type DatevBooking,
  type DatevHeaderOptions,
} from "./datev.builder";

/**
 * Der Buchungsstapel geht an die Steuerkanzlei. Ein Formatfehler fällt dort auf,
 * nicht hier - deshalb ist der Aufbau Zeichen für Zeichen gegen die
 * Formatbeschreibung geprüft.
 */

const options: DatevHeaderOptions = {
  consultantNumber: 1001,
  clientNumber: 456,
  accountLength: 4,
  fiscalStart: "0101",
  from: new Date(Date.UTC(2026, 7, 1)),
  to: new Date(Date.UTC(2026, 7, 31)),
  description: "Autohaus Intranet Bestellungen",
  exportedBy: "Markus Becker",
  generatedAt: new Date(Date.UTC(2026, 8, 18, 11, 11, 25, 372)),
};

const booking: DatevBooking = {
  amount: 248.5,
  debitCredit: "S",
  account: "6110",
  counterAccount: "1600",
  buKey: "9",
  date: new Date(Date.UTC(2026, 7, 22)),
  documentField1: "RE-2026-0042",
  text: "WW-00002 Arbeitskleidung Schulz",
};

function lines(content: string): string[] {
  return content.split("\r\n");
}

describe("buildBuchungsstapel", () => {
  it("schreibt einen Kopfsatz mit genau 31 Feldern", () => {
    const header = lines(buildBuchungsstapel([], options))[0];
    expect(header.split(";")).toHaveLength(31);
  });

  it("setzt die Kennungen des EXTF-Formats an die richtigen Stellen", () => {
    const fields = lines(buildBuchungsstapel([], options))[0].split(";");

    expect(fields[0]).toBe('"EXTF"');
    expect(fields[1]).toBe("700");
    expect(fields[2]).toBe("21");
    expect(fields[3]).toBe('"Buchungsstapel"');
    expect(fields[4]).toBe("13");
    expect(fields[5]).toBe("20260918111125372");
    expect(fields[10]).toBe("1001"); // Berater
    expect(fields[11]).toBe("456"); // Mandant
    expect(fields[12]).toBe("20260101"); // Beginn Wirtschaftsjahr
    expect(fields[13]).toBe("4"); // Sachkontenlänge
    expect(fields[14]).toBe("20260801");
    expect(fields[15]).toBe("20260831");
    expect(fields[21]).toBe('"EUR"');
  });

  it("leitet den Beginn des Wirtschaftsjahres aus TTMM ab", () => {
    const abweichend = { ...options, fiscalStart: "0107" };
    expect(lines(buildBuchungsstapel([], abweichend))[0].split(";")[12]).toBe("20260701");
  });

  it("hält Spaltenzeile und Datenzeilen auf gleicher Feldzahl", () => {
    const result = lines(buildBuchungsstapel([booking], options));

    expect(result[1].split(";")).toHaveLength(DATEV_COLUMNS.length);
    expect(result[2].split(";")).toHaveLength(DATEV_COLUMNS.length);
    expect(DATEV_COLUMNS).toHaveLength(125);
  });

  it("schreibt Beträge mit Dezimalkomma und ohne Vorzeichen", () => {
    const fields = lines(buildBuchungsstapel([{ ...booking, amount: -1234.5 }], options))[2].split(";");

    expect(fields[0]).toBe("1234,50");
    expect(fields[1]).toBe('"S"');
  });

  it("schreibt das Belegdatum als TTMM", () => {
    const fields = lines(buildBuchungsstapel([booking], options))[2].split(";");
    expect(fields[9]).toBe("2208");
  });

  it("übernimmt Konten, BU-Schlüssel, Belegfeld und Text", () => {
    const fields = lines(buildBuchungsstapel([booking], options))[2].split(";");

    expect(fields[6]).toBe("6110");
    expect(fields[7]).toBe("1600");
    expect(fields[8]).toBe('"9"');
    expect(fields[10]).toBe('"RE-2026-0042"');
    expect(fields[13]).toBe('"WW-00002 Arbeitskleidung Schulz"');
  });

  it("lässt den BU-Schlüssel leer, wenn keiner gesetzt ist", () => {
    const ohneSchluessel = { ...booking, buKey: undefined };
    expect(lines(buildBuchungsstapel([ohneSchluessel], options))[2].split(";")[8]).toBe("");
  });

  it("nutzt CRLF und schließt mit einem Zeilenumbruch ab", () => {
    const content = buildBuchungsstapel([booking], options);

    expect(content.endsWith("\r\n")).toBe(true);
    expect(content.includes("\n\n")).toBe(false);
  });

  it("verkraftet einen Stapel ohne Buchungen", () => {
    expect(lines(buildBuchungsstapel([], options)).filter((line) => line.length > 0)).toHaveLength(2);
  });
});

describe("sanitiseText", () => {
  it("entfernt Semikola, die sonst die Spalten zerreißen würden", () => {
    expect(sanitiseText("Rechnung; Position 2")).toBe("Rechnung Position 2");
  });

  it("entfernt Zeilenumbrüche", () => {
    expect(sanitiseText("Zeile eins\nZeile zwei")).toBe("Zeile eins Zeile zwei");
  });

  it("ersetzt das Eurozeichen, das Windows-1252 anders kodiert", () => {
    expect(sanitiseText("Betrag 100 €")).toBe("Betrag 100 EUR");
  });

  it("kürzt auf die zulässige Länge", () => {
    expect(sanitiseText("x".repeat(80))).toHaveLength(60);
  });
});

describe("Anführungszeichen im Text", () => {
  it("verdoppelt Anführungszeichen statt die Spalte zu sprengen", () => {
    const mitZitat = { ...booking, text: 'Artikel "Poloshirt" Service' };
    const fields = lines(buildBuchungsstapel([mitZitat], options))[2].split(";");

    expect(fields[13]).toBe('"Artikel ""Poloshirt"" Service"');
  });
});

describe("toDatevBuffer", () => {
  it("kodiert Umlaute als Einzelbyte, wie DATEV es erwartet", () => {
    const buffer = toDatevBuffer("BU-Schlüssel");

    expect(buffer.toString("latin1")).toBe("BU-Schlüssel");
    expect(buffer).toHaveLength("BU-Schlüssel".length);
  });
});

describe("datevFileName", () => {
  it("benennt die Datei nach dem Zeitraum", () => {
    expect(datevFileName(options.from, options.to)).toBe("EXTF_Buchungsstapel_20260801_20260831.csv");
  });
});
