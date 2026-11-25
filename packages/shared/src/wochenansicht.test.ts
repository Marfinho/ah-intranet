import { describe, expect, it } from "vitest";
import {
  aendereBeginn,
  aendereEnde,
  lokalZuUtc,
  runden,
  schichtSegmente,
  tageZwischen,
  ueberlappungsLayout,
  verschiebeSchicht,
  type Segment,
} from "./index";

const woche = tageZwischen("2026-01-05", "2026-01-11");
const schicht = (id: string, datum: string, von: string, bis: string, bisDatum = datum) => ({
  id,
  startsAt: lokalZuUtc(datum, Number(von.slice(0, 2)) * 60 + Number(von.slice(3))).toISOString(),
  endsAt: lokalZuUtc(bisDatum, Number(bis.slice(0, 2)) * 60 + Number(bis.slice(3))).toISOString(),
});
const segment = (schichtId: string, vonMin: number, bisMin: number, datum = "2026-01-05"): Segment => ({
  schichtId,
  datum,
  vonMin,
  bisMin,
  beginntHier: true,
  endetHier: true,
});

describe("Zeitrechnung für den Plan", () => {
  it("rastet auf Viertelstunden ein", () => {
    expect(runden(7)).toBe(0);
    expect(runden(8)).toBe(15);
    expect(runden(-22)).toBe(-15);
    expect(runden(37)).toBe(30);
  });
});

describe("schichtSegmente", () => {
  it("legt eine Tagesschicht auf einen Tag", () => {
    expect(schichtSegmente(schicht("a", "2026-01-06", "08:00", "15:00"), woche)).toEqual([
      { schichtId: "a", datum: "2026-01-06", vonMin: 480, bisMin: 900, beginntHier: true, endetHier: true },
    ]);
  });

  it("teilt eine Nachtschicht in zwei Segmente", () => {
    const segmente = schichtSegmente(schicht("n", "2026-01-06", "22:00", "06:00", "2026-01-07"), woche);
    expect(segmente).toEqual([
      { schichtId: "n", datum: "2026-01-06", vonMin: 1320, bisMin: 1440, beginntHier: true, endetHier: false },
      { schichtId: "n", datum: "2026-01-07", vonMin: 0, bisMin: 360, beginntHier: false, endetHier: true },
    ]);
  });

  it("lässt eine Schicht bis genau Mitternacht ein Segment bleiben", () => {
    const segmente = schichtSegmente(schicht("m", "2026-01-06", "16:00", "00:00", "2026-01-07"), woche);
    expect(segmente).toHaveLength(1);
    expect(segmente[0].bisMin).toBe(1440);
    expect(segmente[0].endetHier).toBe(true);
  });

  it("zeigt nur den Teil einer Schicht, der in die Woche fällt", () => {
    // Sonntagnacht der Vorwoche in den Montag hinein.
    const segmente = schichtSegmente(schicht("v", "2026-01-04", "22:00", "06:00", "2026-01-05"), woche);
    expect(segmente).toEqual([
      { schichtId: "v", datum: "2026-01-05", vonMin: 0, bisMin: 360, beginntHier: false, endetHier: true },
    ]);
  });

  it("ignoriert Schichten außerhalb der Woche", () => {
    expect(schichtSegmente(schicht("x", "2026-01-12", "08:00", "15:00"), woche)).toEqual([]);
  });
});

describe("ueberlappungsLayout", () => {
  it("lässt Einzelne in voller Breite", () => {
    expect(ueberlappungsLayout([segment("a", 480, 900)])).toEqual([
      expect.objectContaining({ schichtId: "a", spalte: 0, spalten: 1 }),
    ]);
  });

  it("legt zwei Überlappende nebeneinander", () => {
    const platziert = ueberlappungsLayout([segment("a", 480, 720), segment("b", 540, 780)]);
    expect(platziert.map((p) => [p.schichtId, p.spalte, p.spalten])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
    ]);
  });

  it("zählt Berührung nicht als Überlappung", () => {
    const platziert = ueberlappungsLayout([segment("a", 480, 720), segment("b", 720, 900)]);
    expect(platziert.map((p) => p.spalten)).toEqual([1, 1]);
  });

  it("verwendet freie Spalten wieder, ohne die Gruppe breiter zu machen", () => {
    // A 8-12, B 9-13, C 12-14: C passt wieder in Spalte 0; die Gruppe bleibt zweispaltig.
    const platziert = ueberlappungsLayout([segment("a", 480, 720), segment("b", 540, 780), segment("c", 720, 840)]);
    expect(platziert.map((p) => [p.schichtId, p.spalte, p.spalten])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 2],
    ]);
  });

  it("braucht drei Spalten, wenn drei gleichzeitig laufen", () => {
    const platziert = ueberlappungsLayout([segment("a", 480, 900), segment("b", 480, 900), segment("c", 600, 700)]);
    expect(new Set(platziert.map((p) => p.spalten))).toEqual(new Set([3]));
    expect(platziert.map((p) => p.spalte).sort()).toEqual([0, 1, 2]);
  });

  it("trennt die Tage", () => {
    const platziert = ueberlappungsLayout([segment("a", 480, 900, "2026-01-05"), segment("b", 480, 900, "2026-01-06")]);
    expect(platziert.map((p) => p.spalten)).toEqual([1, 1]);
  });
});

describe("Ziehen und Größe ändern", () => {
  const frueh = schicht("a", "2026-01-06", "08:00", "15:00");

  it("verschiebt um Minuten", () => {
    const neu = verschiebeSchicht(frueh, 0, 60);
    expect(neu).toEqual({
      startsAt: schicht("a", "2026-01-06", "09:00", "16:00").startsAt,
      endsAt: schicht("a", "2026-01-06", "09:00", "16:00").endsAt,
    });
  });

  it("verschiebt um Tage und lässt die Uhrzeit stehen", () => {
    const neu = verschiebeSchicht(frueh, 2, 0);
    expect(neu.startsAt).toBe(lokalZuUtc("2026-01-08", 480).toISOString());
    expect(neu.endsAt).toBe(lokalZuUtc("2026-01-08", 900).toISOString());
  });

  it("bleibt über die Sommerzeitumstellung eine Schicht um 8 Uhr", () => {
    const samstag = schicht("s", "2026-03-28", "08:00", "15:00");
    const sonntag = verschiebeSchicht(samstag, 1, 0);
    expect(sonntag.startsAt).toBe("2026-03-29T06:00:00.000Z"); // 08:00 Sommerzeit, nicht 07:00Z
    expect(sonntag.endsAt).toBe("2026-03-29T13:00:00.000Z");
  });

  it("verschiebt eine Nachtschicht samt Folgetag", () => {
    const nacht = schicht("n", "2026-01-06", "22:00", "06:00", "2026-01-07");
    const neu = verschiebeSchicht(nacht, 1, 0);
    expect(neu.startsAt).toBe(lokalZuUtc("2026-01-07", 1320).toISOString());
    expect(neu.endsAt).toBe(lokalZuUtc("2026-01-08", 360).toISOString());
  });

  it("zieht den Beginn früher und lässt das Ende", () => {
    const neu = aendereBeginn(frueh, -30);
    expect(neu.startsAt).toBe(lokalZuUtc("2026-01-06", 450).toISOString());
    expect(neu.endsAt).toBe(frueh.endsAt);
  });

  it("zieht das Ende später und lässt den Beginn", () => {
    const neu = aendereEnde(frueh, 45);
    expect(neu.endsAt).toBe(lokalZuUtc("2026-01-06", 945).toISOString());
    expect(neu.startsAt).toBe(frueh.startsAt);
  });

  it("macht eine Schicht beim Ziehen nie kürzer als die Mindestdauer", () => {
    const zuKurz = aendereBeginn(frueh, 600); // Beginn weit hinter das Ende
    expect(new Date(zuKurz.endsAt).getTime() - new Date(zuKurz.startsAt).getTime()).toBe(30 * 60_000);
    const zuKurz2 = aendereEnde(frueh, -600);
    expect(new Date(zuKurz2.endsAt).getTime() - new Date(zuKurz2.startsAt).getTime()).toBe(30 * 60_000);
  });
});
