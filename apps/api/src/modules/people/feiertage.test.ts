import { describe, expect, it } from "vitest";
import { brueckentage, datumText, feiertage, ostersonntag } from "./feiertage";

const namen = (jahr: number, land: string) => feiertage(jahr, land).map((tag) => tag.name);
const datum = (jahr: number, land: string, name: string) =>
  feiertage(jahr, land).find((tag) => tag.name === name)?.datum;

describe("ostersonntag", () => {
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2038, "2038-04-25"],
  ])("liefert für %i den %s", (jahr, erwartet) => {
    expect(datumText(ostersonntag(jahr))).toBe(erwartet);
  });
});

describe("feiertage", () => {
  it("leitet die beweglichen Tage aus Ostern ab (2026)", () => {
    expect(datum(2026, "NI", "Karfreitag")).toBe("2026-04-03");
    expect(datum(2026, "NI", "Ostermontag")).toBe("2026-04-06");
    expect(datum(2026, "NI", "Christi Himmelfahrt")).toBe("2026-05-14");
    expect(datum(2026, "NI", "Pfingstmontag")).toBe("2026-05-25");
    expect(datum(2026, "BY", "Fronleichnam")).toBe("2026-06-04");
  });

  it("führt in jedem Land die neun bundesweiten Tage", () => {
    for (const land of [
      "BW",
      "BY",
      "BE",
      "BB",
      "HB",
      "HH",
      "HE",
      "MV",
      "NI",
      "NW",
      "RP",
      "SL",
      "SN",
      "ST",
      "SH",
      "TH",
    ]) {
      expect(namen(2026, land)).toEqual(expect.arrayContaining(["Neujahr", "Karfreitag", "2. Weihnachtstag"]));
    }
  });

  it("trennt die Länder: Bremen ohne Fronleichnam, Bayern mit", () => {
    expect(namen(2026, "HB")).not.toContain("Fronleichnam");
    expect(namen(2026, "BY")).toContain("Fronleichnam");
  });

  it("kennt die Sonderfälle je Land", () => {
    expect(namen(2026, "TH")).toContain("Weltkindertag");
    expect(namen(2026, "BE")).toContain("Internationaler Frauentag");
    expect(namen(2026, "SL")).toContain("Mariä Himmelfahrt");
    expect(namen(2026, "BW")).toContain("Heilige Drei Könige");
    expect(namen(2026, "NW")).not.toContain("Reformationstag");
    expect(namen(2026, "NI")).toContain("Reformationstag");
  });

  it("legt den Buß- und Bettag in Sachsen auf den Mittwoch vor dem 23. November", () => {
    expect(datum(2026, "SN", "Buß- und Bettag")).toBe("2026-11-18");
    expect(datum(2025, "SN", "Buß- und Bettag")).toBe("2025-11-19");
    // Fällt der 23. selbst auf einen Mittwoch, ist es der Mittwoch eine Woche davor.
    expect(datum(2022, "SN", "Buß- und Bettag")).toBe("2022-11-16");
  });

  it("ist nach Datum sortiert", () => {
    const liste = feiertage(2026, "BY").map((tag) => tag.datum);
    expect(liste).toEqual([...liste].sort());
  });
});

describe("brueckentage", () => {
  it("schlägt den Freitag nach einem Donnerstags-Feiertag vor", () => {
    // Christi Himmelfahrt 2026: Donnerstag, 14. Mai.
    expect(brueckentage(feiertage(2026, "NI")).map((tag) => tag.datum)).toContain("2026-05-15");
  });

  it("schlägt den Montag vor einem Dienstags-Feiertag vor", () => {
    // 1. Mai 2029 ist ein Dienstag.
    expect(brueckentage(feiertage(2029, "NI")).map((tag) => tag.datum)).toContain("2029-04-30");
  });

  it("lässt Tage weg, die selbst Feiertag sind", () => {
    const liste = [
      { datum: "2026-12-24", name: "A" }, // Donnerstag
      { datum: "2026-12-25", name: "B" }, // Freitag, selbst Feiertag
    ];
    expect(brueckentage(liste)).toEqual([]);
  });
});
