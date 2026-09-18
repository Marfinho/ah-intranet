import { describe, expect, it } from "vitest";
import {
  normaliseHeader,
  parseFlexibleDate,
  parseGermanInteger,
  parseGermanNumber,
  splitCsvLine,
  stripBom,
} from "./csv";

describe("splitCsvLine", () => {
  it("zerlegt eine einfache Zeile am Semikolon", () => {
    expect(splitCsvLine("a;b;c")).toEqual(["a", "b", "c"]);
  });

  it("behält Semikola innerhalb von Anführungszeichen", () => {
    expect(splitCsvLine('a;"b;noch b";c')).toEqual(["a", "b;noch b", "c"]);
  });

  it("löst verdoppelte Anführungszeichen auf", () => {
    expect(splitCsvLine('a;"sagt ""hallo""";c')).toEqual(["a", 'sagt "hallo"', "c"]);
  });

  it("erhält leere Felder", () => {
    expect(splitCsvLine("a;;c")).toEqual(["a", "", "c"]);
  });

  it("erhält ein leeres Feld am Zeilenende", () => {
    expect(splitCsvLine("a;b;")).toEqual(["a", "b", ""]);
  });

  it("kommt mit einem anderen Trennzeichen zurecht", () => {
    expect(splitCsvLine("a,b,c", ",")).toEqual(["a", "b", "c"]);
  });

  it("behandelt eine Zeile ohne Trennzeichen als ein Feld", () => {
    expect(splitCsvLine("nur ein Wert")).toEqual(["nur ein Wert"]);
  });
});

describe("normaliseHeader", () => {
  it("schreibt Umlaute aus", () => {
    expect(normaliseHeader("Fahrzeugnummer")).toBe("fahrzeugnummer");
    expect(normaliseHeader("Größe")).toBe("groesse");
    expect(normaliseHeader("Straße")).toBe("strasse");
  });

  it("ersetzt Sonderzeichen und Leerraum durch Unterstriche", () => {
    expect(normaliseHeader("Leistung (kW)")).toBe("leistung_kw");
    expect(normaliseHeader("  Preis / brutto ")).toBe("preis_brutto");
  });

  it("entfernt Anführungszeichen aus zitierten Überschriften", () => {
    expect(normaliseHeader('"Marke"')).toBe("marke");
  });
});

describe("parseGermanNumber", () => {
  it("liest Dezimalkomma und Tausenderpunkt", () => {
    expect(parseGermanNumber("24.900,00")).toBe(24900);
    expect(parseGermanNumber("27.450,50")).toBe(27450.5);
    expect(parseGermanNumber("1.234.567,89")).toBe(1234567.89);
  });

  it("liest Werte ohne Tausenderpunkt", () => {
    expect(parseGermanNumber("18500")).toBe(18500);
  });

  it("ignoriert Währungszeichen und Leerraum", () => {
    expect(parseGermanNumber("16.750,00 EUR")).toBe(16750);
  });

  it("liefert nichts bei leerer oder unbrauchbarer Eingabe", () => {
    expect(parseGermanNumber("")).toBeUndefined();
    expect(parseGermanNumber(undefined)).toBeUndefined();
    expect(parseGermanNumber("   ")).toBeUndefined();
  });

  it("rundet bei parseGermanInteger", () => {
    expect(parseGermanInteger("96,4")).toBe(96);
    expect(parseGermanInteger("96,6")).toBe(97);
  });
});

describe("parseFlexibleDate", () => {
  const iso = (date: Date | undefined) => date?.toISOString().slice(0, 10);

  it("liest die deutsche Schreibweise", () => {
    expect(iso(parseFlexibleDate("14.03.2023"))).toBe("2023-03-14");
    expect(iso(parseFlexibleDate("1.9.2022"))).toBe("2022-09-01");
  });

  it("liest ISO mit und ohne Tag", () => {
    expect(iso(parseFlexibleDate("2024-01-15"))).toBe("2024-01-15");
    expect(iso(parseFlexibleDate("2024-01"))).toBe("2024-01-01");
  });

  it("liest Monat und Jahr mit Schrägstrich", () => {
    expect(iso(parseFlexibleDate("09/2021"))).toBe("2021-09-01");
  });

  it("verwirft unmögliche Daten, statt sie zu verschieben", () => {
    // Ohne Prüfung würde daraus der 2. März.
    expect(parseFlexibleDate("30.02.2023")).toBeUndefined();
    expect(parseFlexibleDate("14.13.2023")).toBeUndefined();
  });

  it("verwirft unbekannte Formate", () => {
    expect(parseFlexibleDate("irgendwas")).toBeUndefined();
    expect(parseFlexibleDate("")).toBeUndefined();
    expect(parseFlexibleDate(undefined)).toBeUndefined();
  });
});

describe("stripBom", () => {
  it("entfernt ein führendes Byte-Order-Mark", () => {
    expect(stripBom("﻿Fahrzeugnummer")).toBe("Fahrzeugnummer");
  });

  it("lässt Text ohne BOM unverändert", () => {
    expect(stripBom("Fahrzeugnummer")).toBe("Fahrzeugnummer");
  });
});
