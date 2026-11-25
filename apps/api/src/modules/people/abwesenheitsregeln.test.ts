import { describe, expect, it } from "vitest";
import { anfangsstatus, arbeitstage, darfErfassen, freieTage, kalenderSicht } from "./abwesenheitsregeln";

const tag = (text: string) => new Date(`${text}T00:00:00Z`);
const keine = new Set<string>();

describe("arbeitstage", () => {
  it("zählt Montag bis Freitag", () => {
    expect(arbeitstage({ von: tag("2026-09-14"), bis: tag("2026-09-18"), freieTage: keine })).toBe(5);
  });

  it("lässt Wochenenden aus, auch an verkaufsoffenen Sonntagen", () => {
    // Montag bis Montag; der Sonntag dazwischen wäre ein Arbeitstag im Betriebskalender.
    expect(arbeitstage({ von: tag("2026-09-14"), bis: tag("2026-09-21"), freieTage: keine })).toBe(6);
  });

  it("zieht freie Tage des Betriebskalenders ab", () => {
    // Karfreitag und Ostermontag 2026
    const frei = new Set(["2026-04-03", "2026-04-06"]);
    expect(arbeitstage({ von: tag("2026-03-30"), bis: tag("2026-04-10"), freieTage: frei })).toBe(8);
  });

  it("zählt einen Zeitraum nur aus freien Tagen als null", () => {
    expect(arbeitstage({ von: tag("2026-12-25"), bis: tag("2026-12-26"), freieTage: new Set(["2026-12-25"]) })).toBe(0);
  });

  it("rechnet halbe Tage an den Rändern", () => {
    expect(arbeitstage({ von: tag("2026-09-14"), bis: tag("2026-09-16"), freieTage: keine, startHalb: true })).toBe(
      2.5,
    );
    expect(
      arbeitstage({ von: tag("2026-09-14"), bis: tag("2026-09-16"), freieTage: keine, startHalb: true, endHalb: true }),
    ).toBe(2);
  });

  it("macht aus einem Einzeltag mit Halbtag einen halben Tag", () => {
    expect(arbeitstage({ von: tag("2026-09-16"), bis: tag("2026-09-16"), freieTage: keine, startHalb: true })).toBe(
      0.5,
    );
    expect(
      arbeitstage({ von: tag("2026-09-16"), bis: tag("2026-09-16"), freieTage: keine, startHalb: true, endHalb: true }),
    ).toBe(0.5);
  });

  it("zählt einen Halbtag auf einem freien Tag nicht", () => {
    // Samstag
    expect(arbeitstage({ von: tag("2026-09-19"), bis: tag("2026-09-21"), freieTage: keine, startHalb: true })).toBe(1);
  });
});

describe("freieTage", () => {
  const haus = (datum: string, arbeitsfrei: boolean) => ({ datum, arbeitsfrei, locationId: null });
  const standort = (datum: string, arbeitsfrei: boolean, locationId: string) => ({ datum, arbeitsfrei, locationId });

  it("nimmt Einträge für das ganze Haus und für den eigenen Standort", () => {
    const tage = freieTage(
      [haus("2026-01-01", true), standort("2026-05-04", true, "HB"), standort("2026-05-05", true, "DE")],
      "HB",
    );
    expect([...tage].sort()).toEqual(["2026-01-01", "2026-05-04"]);
  });

  it("lässt den Standort das Haus überstimmen", () => {
    const tage = freieTage([haus("2026-11-01", true), standort("2026-11-01", false, "HB")], "HB");
    expect(tage.has("2026-11-01")).toBe(false);
  });

  it("gilt auf gleicher Ebene als frei, wenn einer frei sagt", () => {
    const tage = freieTage([standort("2026-05-14", true, "HB"), standort("2026-05-14", false, "HB")], "HB");
    expect(tage.has("2026-05-14")).toBe(true);
  });

  it("zählt Arbeitstage nicht als frei", () => {
    expect(freieTage([haus("2026-04-12", false)], "HB").size).toBe(0);
  });

  it("kennt ohne Standort nur das ganze Haus", () => {
    const tage = freieTage([haus("2026-01-01", true), standort("2026-05-04", true, "HB")], null);
    expect([...tage]).toEqual(["2026-01-01"]);
  });
});

describe("anfangsstatus", () => {
  it("lässt Krankmeldungen sofort gelten", () => {
    expect(anfangsstatus({ art: "krank", fuerAndere: false })).toBe("approved");
  });

  it("verlangt für den eigenen Urlaub eine Freigabe", () => {
    expect(anfangsstatus({ art: "urlaub", fuerAndere: false })).toBe("submitted");
  });

  it("lässt Einträge der Führungskraft für andere sofort gelten", () => {
    expect(anfangsstatus({ art: "urlaub", fuerAndere: true })).toBe("approved");
  });
});

describe("darfErfassen", () => {
  const personen = [
    { id: "gf", managerId: null },
    { id: "leitung", managerId: "gf" },
    { id: "a", managerId: "leitung" },
    { id: "nachbar", managerId: "gf" },
  ];
  const mit = (akteurId: string, zielId: string, darfFreigeben = true, sieheAlle = false) =>
    darfErfassen({ akteurId, zielId, personen, darfFreigeben, sieheAlle });

  it("erlaubt jeder Person den eigenen Eintrag, auch ohne Freigaberecht", () => {
    expect(mit("a", "a", false)).toBe(true);
  });

  it("erlaubt der Leitung den Eintrag für Unterstellte", () => {
    expect(mit("leitung", "a")).toBe(true);
  });

  it("erlaubt auch mittelbar Unterstellte", () => {
    expect(mit("gf", "a")).toBe(true);
  });

  it("verweigert den Eintrag für die Nachbarabteilung", () => {
    expect(mit("leitung", "nachbar")).toBe(false);
  });

  it("verweigert ohne Freigaberecht den Eintrag für andere", () => {
    expect(mit("leitung", "a", false)).toBe(false);
  });

  it("erlaubt mit dem Recht auf alle Abwesenheiten jeden Eintrag", () => {
    expect(mit("leitung", "nachbar", true, true)).toBe(true);
  });

  it("verweigert Unterstellten den Eintrag für die Vorgesetzte", () => {
    expect(mit("a", "leitung")).toBe(false);
  });
});

describe("kalenderSicht", () => {
  const personen = [
    { id: "gf", managerId: null },
    { id: "leitung", managerId: "gf" },
    { id: "a", managerId: "leitung" },
    { id: "b", managerId: "leitung" },
    { id: "nachbar", managerId: "gf" },
    { id: "c", managerId: "nachbar" },
  ];
  const sicht = (akteurId: string, zielId: string, darfFreigeben = false, sieheAlle = false) =>
    kalenderSicht({ akteurId, zielId, personen, darfFreigeben, sieheAlle });

  it("zeigt die eigene Abwesenheit mit Grund", () => {
    expect(sicht("a", "a")).toBe("voll");
  });

  it("zeigt Teamkolleginnen nur als abwesend", () => {
    expect(sicht("a", "b")).toBe("abwesend");
  });

  it("zeigt auch die Vorgesetzte nur als abwesend", () => {
    expect(sicht("a", "leitung")).toBe("abwesend");
  });

  it("zeigt nichts aus anderen Teams", () => {
    expect(sicht("a", "c")).toBe("keine");
    expect(sicht("a", "nachbar")).toBe("keine");
  });

  it("zeigt der Teamleitung ihre Unterstellten mit Grund, auch mittelbar", () => {
    expect(sicht("leitung", "a", true)).toBe("voll");
    expect(sicht("gf", "a", true)).toBe("voll");
  });

  it("zeigt der Teamleitung ihre Gleichgestellten nur als abwesend", () => {
    expect(sicht("leitung", "nachbar", true)).toBe("abwesend");
  });

  it("zeigt Teamleitung ohne Freigaberecht ihre direkt Unterstellten nur als abwesend", () => {
    expect(sicht("leitung", "a", false)).toBe("abwesend");
    expect(sicht("gf", "a", false)).toBe("keine");
  });

  it("zeigt mit dem Recht auf alle Abwesenheiten jede Person mit Grund", () => {
    expect(sicht("a", "c", false, true)).toBe("voll");
  });
});
