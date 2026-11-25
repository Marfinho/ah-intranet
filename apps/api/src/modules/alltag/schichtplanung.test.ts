import { describe, expect, it } from "vitest";
import {
  giltAn,
  isoWochentag,
  lokalZuUtc,
  lokalesDatum,
  nettoMinuten,
  parseZeit,
  passtInZeitfenster,
  planeSchichten,
  pruefeArbeitszeit,
  pruefeSchichtart,
  schichtZeitraum,
  tagesarten,
  wochenStart,
  type PersonPlan,
  type PlanEingabe,
  type SchichtartRef,
} from "./schichtplanung";

const art = (aenderungen: Partial<SchichtartRef> = {}): SchichtartRef => ({
  id: "frueh",
  name: "Frühschicht",
  startZeit: "08:00",
  endZeit: "15:00",
  pauseMinuten: 30,
  mindestBesetzung: 1,
  idealBesetzung: 2,
  tage: [1, 2, 3, 4, 5],
  beiSondertag: false,
  locationId: null,
  departmentId: null,
  teamLeadId: null,
  ...aenderungen,
});

const person = (id: string, aenderungen: Partial<PersonPlan> = {}): PersonPlan => ({
  id,
  locationId: null,
  departmentId: null,
  managerId: null,
  wochenstunden: null,
  zeitfensterVon: null,
  zeitfensterBis: null,
  arbeitstage: [1, 2, 3, 4, 5],
  ...aenderungen,
});

const plan = (aenderungen: Partial<PlanEingabe>): PlanEingabe => ({
  von: "2026-01-05",
  bis: "2026-01-05",
  arten: [art()],
  personen: [],
  vorhanden: [],
  abwesend: new Map(),
  betriebstage: [],
  ...aenderungen,
});

const iso = (datum: Date) => datum.toISOString();

describe("Zeitrechnung", () => {
  it("liest Uhrzeiten und weist Ungültiges ab", () => {
    expect(parseZeit("08:00")).toBe(480);
    expect(parseZeit("23:59")).toBe(1439);
    expect(parseZeit("24:00")).toBeNull();
    expect(parseZeit("8:00")).toBeNull();
    expect(parseZeit("08:60")).toBeNull();
  });

  it("rechnet Ortszeit im Winter und im Sommer richtig nach UTC", () => {
    expect(iso(lokalZuUtc("2026-01-05", 480))).toBe("2026-01-05T07:00:00.000Z");
    expect(iso(lokalZuUtc("2026-07-06", 480))).toBe("2026-07-06T06:00:00.000Z");
  });

  it("trifft die Sommerzeitumstellung: Frühschicht bleibt Frühschicht", () => {
    expect(iso(lokalZuUtc("2026-03-28", 480))).toBe("2026-03-28T07:00:00.000Z");
    expect(iso(lokalZuUtc("2026-03-29", 480))).toBe("2026-03-29T06:00:00.000Z");
    expect(iso(lokalZuUtc("2026-10-25", 480))).toBe("2026-10-25T07:00:00.000Z");
  });

  it("kennt Minuten über Mitternacht", () => {
    expect(iso(lokalZuUtc("2026-01-05", 1440 + 360))).toBe("2026-01-06T05:00:00.000Z");
  });

  it("bestimmt das lokale Datum, auch kurz nach Mitternacht", () => {
    // 23:30 UTC ist in Berlin schon der nächste Tag.
    expect(lokalesDatum(new Date("2026-01-05T23:30:00Z"))).toBe("2026-01-06");
  });

  it("kennt Wochentage und Wochenanfang", () => {
    expect(isoWochentag("2026-01-05")).toBe(1);
    expect(isoWochentag("2026-01-11")).toBe(7);
    expect(wochenStart("2026-01-11")).toBe("2026-01-05");
    expect(wochenStart("2026-01-05")).toBe("2026-01-05");
  });

  it("legt eine Schicht über Mitternacht auf den Folgetag und rechnet Netto ohne Pause", () => {
    const nacht = schichtZeitraum({ startZeit: "22:00", endZeit: "06:00" }, "2026-01-05");
    expect(iso(nacht.ende)).toBe("2026-01-06T05:00:00.000Z");
    expect(nettoMinuten(nacht, 30)).toBe(450);
  });
});

describe("Zeitfenster und Tagesarten", () => {
  it("lässt Teilzeitkräfte mit Vormittagsfenster nur Schichten darin machen", () => {
    const vormittags = person("t", { zeitfensterVon: "08:00", zeitfensterBis: "13:00" });
    expect(passtInZeitfenster(vormittags, art({ startZeit: "08:00", endZeit: "12:00" }))).toBe(true);
    expect(passtInZeitfenster(vormittags, art({ startZeit: "08:00", endZeit: "15:00" }))).toBe(false);
    expect(passtInZeitfenster(vormittags, art({ startZeit: "12:00", endZeit: "18:00" }))).toBe(false);
  });

  it("verweigert Nachtschichten bei gesetztem Zeitfenster", () => {
    const vormittags = person("t", { zeitfensterVon: "00:00", zeitfensterBis: "23:59" });
    expect(passtInZeitfenster(vormittags, art({ startZeit: "22:00", endZeit: "06:00" }))).toBe(false);
  });

  it("kennt ohne Fenster keine Einschränkung", () => {
    expect(passtInZeitfenster(person("x"), art({ startZeit: "22:00", endZeit: "06:00" }))).toBe(true);
  });

  it("trennt freie Tage und ausdrückliche Arbeitstage und lässt den Standort das Haus überstimmen", () => {
    const tage = [
      { datum: "2026-01-01", arbeitsfrei: true, locationId: null },
      { datum: "2026-01-11", arbeitsfrei: false, locationId: null },
      { datum: "2026-05-01", arbeitsfrei: true, locationId: null },
      { datum: "2026-05-01", arbeitsfrei: false, locationId: "HB" },
    ];
    expect([...tagesarten(tage, "HB").frei]).toEqual(["2026-01-01"]);
    expect([...tagesarten(tage, "HB").arbeit].sort()).toEqual(["2026-01-11", "2026-05-01"]);
    expect([...tagesarten(tage, "DE").frei].sort()).toEqual(["2026-01-01", "2026-05-01"]);
  });

  it("fährt eine Schichtart nur an ihren Wochentagen, nicht an freien Tagen", () => {
    const leer = tagesarten([], null);
    expect(giltAn(art(), "2026-01-05", leer)).toBe(true);
    expect(giltAn(art(), "2026-01-10", leer)).toBe(false);
    expect(
      giltAn(art(), "2026-01-05", tagesarten([{ datum: "2026-01-05", arbeitsfrei: true, locationId: null }], null)),
    ).toBe(false);
  });

  it("fährt an einem verkaufsoffenen Sonntag nur Schichtarten mit beiSondertag", () => {
    const tag = tagesarten([{ datum: "2026-01-11", arbeitsfrei: false, locationId: null }], null);
    expect(giltAn(art(), "2026-01-11", tag)).toBe(false);
    expect(giltAn(art({ beiSondertag: true }), "2026-01-11", tag)).toBe(true);
  });
});

describe("planeSchichten", () => {
  it("besetzt bis zur Idealbesetzung", () => {
    const ergebnis = planeSchichten(plan({ personen: [person("a"), person("b"), person("c")] }));
    expect(ergebnis.zuweisungen.map((z) => z.userId)).toEqual(["a", "b"]);
    expect(ergebnis.luecken).toEqual([]);
  });

  it("meldet eine Lücke und ob sie unter der Mindestbesetzung liegt", () => {
    const ergebnis = planeSchichten(
      plan({ personen: [person("a")], arten: [art({ mindestBesetzung: 2, idealBesetzung: 3 })] }),
    );
    expect(ergebnis.zuweisungen).toHaveLength(1);
    expect(ergebnis.luecken).toEqual([
      { schichtartId: "frueh", datum: "2026-01-05", soll: 3, mindest: 2, besetzt: 1, unterMindest: true },
    ]);
  });

  it("beachtet das Zeitfenster von Teilzeitkräften", () => {
    const ergebnis = planeSchichten(
      plan({
        personen: [person("teilzeit", { zeitfensterVon: "08:00", zeitfensterBis: "13:00" }), person("voll")],
        arten: [art({ idealBesetzung: 2 })],
      }),
    );
    expect(ergebnis.zuweisungen.map((z) => z.userId)).toEqual(["voll"]);
    expect(ergebnis.luecken[0].besetzt).toBe(1);
  });

  it("beachtet die Arbeitstage der Person", () => {
    const ergebnis = planeSchichten(
      plan({
        von: "2026-01-07",
        bis: "2026-01-07", // Mittwoch
        personen: [person("a", { arbeitstage: [1, 2] })],
        arten: [art({ idealBesetzung: 1 })],
      }),
    );
    expect(ergebnis.zuweisungen).toEqual([]);
  });

  it("teilt niemanden ein, der abwesend ist", () => {
    const ergebnis = planeSchichten(
      plan({
        personen: [person("a"), person("b")],
        arten: [art({ idealBesetzung: 1 })],
        abwesend: new Map([["a", new Set(["2026-01-05"])]]),
      }),
    );
    expect(ergebnis.zuweisungen.map((z) => z.userId)).toEqual(["b"]);
  });

  it("plant an Feiertagen nichts und meldet dort keine Lücke", () => {
    const ergebnis = planeSchichten(
      plan({
        personen: [person("a")],
        betriebstage: [{ datum: "2026-01-05", arbeitsfrei: true, locationId: null }],
      }),
    );
    expect(ergebnis).toEqual({ zuweisungen: [], luecken: [] });
  });

  it("plant an einem verkaufsoffenen Sonntag nur Schichtarten mit beiSondertag", () => {
    const sonntag = { von: "2026-01-11", bis: "2026-01-11" } as const;
    const betriebstage = [{ datum: "2026-01-11", arbeitsfrei: false, locationId: null }];
    const personen = [person("a", { arbeitstage: [1, 2, 3, 4, 5, 6, 7] })];
    expect(planeSchichten(plan({ ...sonntag, personen, betriebstage })).zuweisungen).toEqual([]);
    expect(
      planeSchichten(
        plan({ ...sonntag, personen, betriebstage, arten: [art({ beiSondertag: true, idealBesetzung: 1 })] }),
      ).zuweisungen,
    ).toHaveLength(1);
  });

  it("überschreitet nie die vereinbarten Wochenstunden", () => {
    // 6,5 Stunden netto je Schicht; 13 Stunden pro Woche = zwei Schichten.
    const ergebnis = planeSchichten(
      plan({
        von: "2026-01-05",
        bis: "2026-01-09",
        personen: [person("teilzeit", { wochenstunden: 13 })],
        arten: [art({ idealBesetzung: 1 })],
      }),
    );
    expect(ergebnis.zuweisungen.map((z) => z.datum)).toEqual(["2026-01-05", "2026-01-06"]);
    expect(ergebnis.luecken).toHaveLength(3);
  });

  it("erzeugt keinen Verstoß gegen die Ruhezeit", () => {
    const spaet = art({
      id: "spaet",
      name: "Spät",
      startZeit: "14:00",
      endZeit: "22:00",
      tage: [1],
      idealBesetzung: 1,
    });
    const frueh = art({
      id: "frueh",
      name: "Früh",
      startZeit: "06:00",
      endZeit: "14:00",
      tage: [2],
      idealBesetzung: 1,
    });
    const ergebnis = planeSchichten(plan({ bis: "2026-01-06", arten: [spaet, frueh], personen: [person("a")] }));
    expect(ergebnis.zuweisungen.map((z) => `${z.schichtartId}@${z.datum}`)).toEqual(["spaet@2026-01-05"]);
    expect(ergebnis.luecken.map((l) => l.schichtartId)).toEqual(["frueh"]);
  });

  it("weist die Ruhezeit-Schicht der zweiten Person zu, wenn es sie gibt", () => {
    const spaet = art({
      id: "spaet",
      name: "Spät",
      startZeit: "14:00",
      endZeit: "22:00",
      tage: [1],
      idealBesetzung: 1,
    });
    const frueh = art({
      id: "frueh",
      name: "Früh",
      startZeit: "06:00",
      endZeit: "14:00",
      tage: [2],
      idealBesetzung: 1,
    });
    const ergebnis = planeSchichten(
      plan({ bis: "2026-01-06", arten: [spaet, frueh], personen: [person("a"), person("b")] }),
    );
    expect(ergebnis.zuweisungen.map((z) => `${z.schichtartId}:${z.userId}`)).toEqual(["spaet:a", "frueh:b"]);
  });

  it("füllt erst alle Schichtarten bis zur Mindestbesetzung, dann bis zur Idealbesetzung", () => {
    const a = art({ id: "a", idealBesetzung: 3 });
    const b = art({ id: "b", idealBesetzung: 1 });
    const ergebnis = planeSchichten(plan({ arten: [a, b], personen: [person("p1"), person("p2"), person("p3")] }));
    const je = (id: string) => ergebnis.zuweisungen.filter((z) => z.schichtartId === id).length;
    expect(je("b")).toBe(1);
    expect(je("a")).toBe(2);
  });

  it("zählt bestehende Schichten zur Besetzung und teilt die Person nicht doppelt ein", () => {
    const start = lokalZuUtc("2026-01-05", 480);
    const ende = lokalZuUtc("2026-01-05", 900);
    const ergebnis = planeSchichten(
      plan({
        personen: [person("a"), person("b"), person("c")],
        vorhanden: [{ userId: "a", start, ende, pauseMinuten: 30, schichtartId: "frueh" }],
      }),
    );
    expect(ergebnis.zuweisungen.map((z) => z.userId)).toEqual(["b"]);
  });

  it("verteilt gleichmäßig auf die Belegschaft", () => {
    const ergebnis = planeSchichten(
      plan({
        bis: "2026-01-07",
        personen: [person("a"), person("b")],
        arten: [art({ idealBesetzung: 1 })],
      }),
    );
    expect(ergebnis.zuweisungen.map((z) => z.userId)).toEqual(["a", "b", "a"]);
  });

  it("plant nur Personen aus dem Bereich der Schichtart", () => {
    const ergebnis = planeSchichten(
      plan({
        personen: [person("fremd", { managerId: "x" }), person("mein", { managerId: "lead" })],
        arten: [art({ teamLeadId: "lead", idealBesetzung: 2 })],
      }),
    );
    expect(ergebnis.zuweisungen.map((z) => z.userId)).toEqual(["mein"]);
  });

  it("ist deterministisch: gleiche Eingabe, gleiches Ergebnis", () => {
    const eingabe = plan({ bis: "2026-01-09", personen: [person("c"), person("a"), person("b")] });
    expect(planeSchichten(eingabe)).toEqual(planeSchichten(eingabe));
  });
});

describe("pruefeArbeitszeit", () => {
  const schicht = (userId: string, datum: string, von: string, bis: string, pause = 30) => ({
    userId,
    start: lokalZuUtc(datum, parseZeit(von)!),
    ende: lokalZuUtc(datum, parseZeit(bis)!),
    pauseMinuten: pause,
  });
  const arten = (befunde: ReturnType<typeof pruefeArbeitszeit>) => befunde.map((b) => `${b.art}:${b.schwere}`);

  it("meldet nichts bei einem ordentlichen Plan", () => {
    expect(pruefeArbeitszeit([schicht("a", "2026-01-05", "08:00", "16:00")])).toEqual([]);
  });

  it("markiert eine unterschrittene Ruhezeit", () => {
    const befunde = pruefeArbeitszeit([
      schicht("a", "2026-01-05", "14:00", "22:00"),
      schicht("a", "2026-01-06", "06:00", "14:00"),
    ]);
    expect(arten(befunde)).toEqual(["ruhezeit:verstoss"]);
    expect(befunde[0].datum).toBe("2026-01-06");
    expect(befunde[0].text).toContain("8 Stunden");
  });

  it("akzeptiert genau elf Stunden Ruhezeit", () => {
    expect(
      pruefeArbeitszeit([schicht("a", "2026-01-05", "14:00", "22:00"), schicht("a", "2026-01-06", "09:00", "17:00")]),
    ).toEqual([]);
  });

  it("markiert eine zu kurze Pause nach Dauer gestaffelt", () => {
    // 8 Stunden ohne Pause: mehr als sechs Stunden Arbeit verlangen 30 Minuten.
    expect(arten(pruefeArbeitszeit([schicht("a", "2026-01-05", "08:00", "16:00", 0)]))).toEqual(["pause:verstoss"]);
    // 9,5 Stunden brutto, 30 Minuten Pause = 9 Stunden netto: noch keine 45 Minuten nötig.
    expect(
      pruefeArbeitszeit([schicht("a", "2026-01-05", "08:00", "17:30", 30)]).filter((b) => b.art === "pause"),
    ).toEqual([]);
    // 10,5 Stunden brutto, 30 Minuten = 10 Stunden netto: 45 Minuten nötig.
    expect(pruefeArbeitszeit([schicht("a", "2026-01-05", "08:00", "18:30", 30)]).map((b) => b.art)).toContain("pause");
  });

  it("trennt Hinweis (über acht) und Verstoß (über zehn Stunden am Tag)", () => {
    expect(arten(pruefeArbeitszeit([schicht("a", "2026-01-05", "08:00", "18:00", 60)]))).toEqual([
      "hoechstarbeitszeit:hinweis",
    ]);
    expect(arten(pruefeArbeitszeit([schicht("a", "2026-01-05", "07:00", "19:00", 60)]))).toEqual([
      "hoechstarbeitszeit:verstoss",
    ]);
  });

  it("rechnet mehrere Schichten desselben Tages zusammen", () => {
    const befunde = pruefeArbeitszeit([
      schicht("a", "2026-01-05", "06:00", "12:00", 0),
      schicht("a", "2026-01-05", "23:00", "23:59", 0),
      schicht("a", "2026-01-05", "13:00", "19:00", 30),
    ]);
    expect(befunde.some((b) => b.art === "hoechstarbeitszeit" && b.schwere === "verstoss")).toBe(true);
  });

  it("weist auf mehr als 48 Wochenstunden und auf überschrittene vereinbarte Stunden hin", () => {
    const woche = ["05", "06", "07", "08", "09", "10"].map((tag) =>
      schicht("a", `2026-01-${tag}`, "08:00", "18:00", 60),
    );
    expect(pruefeArbeitszeit(woche).some((b) => b.art === "wochenstunden" && b.text.includes("48"))).toBe(true);

    const teilzeit = ["05", "06", "07"].map((tag) => schicht("t", `2026-01-${tag}`, "08:00", "16:00", 30));
    const befunde = pruefeArbeitszeit(teilzeit, new Map([["t", 20]]));
    expect(befunde.filter((b) => b.art === "wochenstunden")).toHaveLength(1);
    expect(befunde[0].text).toContain("vereinbart");
  });

  it("prüft jede Person für sich", () => {
    const befunde = pruefeArbeitszeit([
      schicht("a", "2026-01-05", "14:00", "22:00"),
      schicht("b", "2026-01-06", "06:00", "14:00"),
    ]);
    expect(befunde).toEqual([]);
  });
});

describe("pruefeSchichtart", () => {
  it("markiert fehlende Pause und lange Schichten schon an der Vorlage", () => {
    expect(pruefeSchichtart({ startZeit: "22:00", endZeit: "06:00", pauseMinuten: 0 }).map((b) => b.schwere)).toEqual([
      "verstoss",
    ]);
    expect(pruefeSchichtart({ startZeit: "08:00", endZeit: "17:30", pauseMinuten: 30 })).toEqual([
      expect.objectContaining({ schwere: "hinweis" }),
    ]);
    expect(pruefeSchichtart({ startZeit: "08:00", endZeit: "15:00", pauseMinuten: 30 })).toEqual([]);
  });
});
