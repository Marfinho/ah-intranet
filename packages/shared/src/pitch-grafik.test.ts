import { describe, expect, it } from "vitest";
import { bahn, polar, ringSegment, segmente, verteile } from "./index";

describe("polar", () => {
  it("liest 0° als oben und geht im Uhrzeigersinn", () => {
    const oben = polar(100, 100, 50, 0);
    const rechts = polar(100, 100, 50, 90);
    const unten = polar(100, 100, 50, 180);
    expect([oben.x, oben.y]).toEqual([100, 50]);
    expect(Math.round(rechts.x)).toBe(150);
    expect(Math.round(rechts.y)).toBe(100);
    expect(Math.round(unten.y)).toBe(150);
  });
});

describe("segmente", () => {
  it("füllen den Kreis samt Lücken genau aus", () => {
    const gruppen = [0, 0, 0, 1, 1, 2, 2, 2, 2, 3];
    const liste = segmente(gruppen.length, gruppen, 2);
    const breite = liste[0].bis - liste[0].von;
    const luecken = liste.reduce((summe, segment, i) => {
      const naechste = liste[(i + 1) % liste.length];
      const abstand = (naechste.von - segment.bis + 360) % 360;
      return summe + abstand;
    }, 0);
    expect(breite * liste.length + luecken).toBeCloseTo(360, 5);
  });

  it("macht die Lücke beim Gruppenwechsel größer", () => {
    const liste = segmente(4, [0, 0, 1, 1], 2);
    const innen = liste[1].von - liste[0].bis;
    const wechsel = liste[2].von - liste[1].bis;
    expect(wechsel).toBeCloseTo(innen * 3, 5);
  });

  it("gibt bei null Segmenten nichts zurück", () => {
    expect(segmente(0, [])).toEqual([]);
  });

  it("legt die Mitte in das Segment", () => {
    for (const segment of segmente(6, [0, 0, 0, 1, 1, 1])) {
      expect(segment.mitte).toBeGreaterThan(segment.von);
      expect(segment.mitte).toBeLessThan(segment.bis);
    }
  });
});

describe("ringSegment", () => {
  it("liefert einen geschlossenen Pfad", () => {
    const pfad = ringSegment(500, 500, 250, 300, 0, 30);
    expect(pfad.startsWith("M")).toBe(true);
    expect(pfad.endsWith("Z")).toBe(true);
    expect(pfad.match(/A/g)).toHaveLength(2);
  });

  it("setzt das große Bogenkennzeichen erst über 180°", () => {
    expect(ringSegment(0, 0, 10, 20, 0, 100)).toContain(" 0 0 1 ");
    expect(ringSegment(0, 0, 10, 20, 0, 200)).toContain(" 0 1 1 ");
  });
});

describe("verteile", () => {
  it("verteilt gleichmäßig", () => {
    expect(verteile(4)).toEqual([0, 90, 180, 270]);
    expect(verteile(1, 45)).toEqual([45]);
  });
});

describe("bahn", () => {
  it("beginnt und endet an den Punkten", () => {
    const pfad = bahn({ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 50, y: 50 });
    expect(pfad.startsWith("M10 10")).toBe(true);
    expect(pfad.endsWith("90 10")).toBe(true);
  });

  it("wird bei zug 0 zur Geraden durch die Mitte der Punkte", () => {
    expect(bahn({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }, 0)).toBe("M0 0 Q50 0 100 0");
  });
});
