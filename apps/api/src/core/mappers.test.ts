import { describe, expect, it } from "vitest";
import { buildNumber, buildScopes, displayName, primaryRole, scopeLabel, workingDaysBetween } from "./mappers";

/**
 * Diese Funktionen entscheiden über Urlaubskonten, Sichtbarkeit von Inhalten und
 * Vorgangsnummern. Fehler hier fallen im Betrieb erst spät auf.
 */

describe("workingDaysBetween", () => {
  const day = (year: number, month: number, date: number) => new Date(Date.UTC(year, month - 1, date));

  it("zählt einen einzelnen Werktag", () => {
    // Mittwoch
    expect(workingDaysBetween(day(2026, 9, 16), day(2026, 9, 16))).toBe(1);
  });

  it("zählt beide Randtage mit", () => {
    // Montag bis Freitag
    expect(workingDaysBetween(day(2026, 9, 14), day(2026, 9, 18))).toBe(5);
  });

  it("lässt Wochenenden aus", () => {
    // Montag bis Montag der Folgewoche
    expect(workingDaysBetween(day(2026, 9, 14), day(2026, 9, 21))).toBe(6);
  });

  it("ergibt null, wenn der Zeitraum nur aufs Wochenende fällt", () => {
    // Samstag und Sonntag
    expect(workingDaysBetween(day(2026, 9, 19), day(2026, 9, 20))).toBe(0);
  });

  it("ergibt null, wenn das Ende vor dem Beginn liegt", () => {
    expect(workingDaysBetween(day(2026, 9, 18), day(2026, 9, 14))).toBe(0);
  });

  it("rechnet über einen Monatswechsel hinweg", () => {
    // 28.09. (Mo) bis 02.10. (Fr) 2026
    expect(workingDaysBetween(day(2026, 9, 28), day(2026, 10, 2))).toBe(5);
  });

  it("rechnet über einen Jahreswechsel hinweg", () => {
    // 30.12.2026 (Mi) bis 01.01.2027 (Fr)
    expect(workingDaysBetween(day(2026, 12, 30), day(2027, 1, 1))).toBe(3);
  });
});

describe("buildScopes", () => {
  it("enthält immer den globalen Scope", () => {
    expect(buildScopes({})).toEqual(["global"]);
  });

  it("bildet Standort, Abteilung und Fachbereich als Tokens ab", () => {
    expect(buildScopes({ locationCode: "HB", departmentCode: "SRV", specialtyCode: "EMOB" })).toEqual([
      "global",
      "location:HB",
      "department:SRV",
      "specialty:EMOB",
    ]);
  });

  it("überspringt leere Angaben, statt leere Tokens zu erzeugen", () => {
    expect(buildScopes({ locationCode: "HB", departmentCode: null, specialtyCode: undefined })).toEqual([
      "global",
      "location:HB",
    ]);
  });
});

describe("primaryRole", () => {
  it("wählt die höchste Rolle nach Rangfolge", () => {
    expect(primaryRole(["mitarbeiter", "admin", "fuehrungskraft"])).toBe("admin");
    expect(primaryRole(["mitarbeiter", "fuehrungskraft"])).toBe("fuehrungskraft");
    expect(primaryRole(["fachbereichsadmin", "mitarbeiter"])).toBe("fachbereichsadmin");
  });

  it("fällt ohne Rollen auf die Standardrolle zurück", () => {
    expect(primaryRole([])).toBe("mitarbeiter");
  });
});

describe("displayName", () => {
  it("setzt Vor- und Nachnamen zusammen", () => {
    expect(displayName({ firstName: "Paul", lastName: "Hansen" })).toBe("Paul Hansen");
  });

  it("liefert einen Platzhalter statt leerer Zeichenkette", () => {
    expect(displayName(null)).toBe("Unbekannt");
    expect(displayName(undefined)).toBe("Unbekannt");
  });
});

describe("scopeLabel", () => {
  it("verkettet die vorhandenen Ebenen", () => {
    expect(scopeLabel({ location: { name: "Bremen" }, department: { name: "Service" } })).toBe("Bremen · Service");
  });

  it("nennt ohne Zuordnung das Gesamtunternehmen", () => {
    expect(scopeLabel({})).toBe("Gesamtes Unternehmen");
  });
});

describe("buildNumber", () => {
  it("füllt die laufende Nummer auf fünf Stellen auf", () => {
    expect(buildNumber("BC", 1)).toBe("BC-00001");
    expect(buildNumber("WW", 42)).toBe("WW-00042");
  });

  it("schneidet längere Nummern nicht ab", () => {
    expect(buildNumber("TIC", 123456)).toBe("TIC-123456");
  });
});
