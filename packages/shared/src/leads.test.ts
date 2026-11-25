import { describe, expect, it } from "vitest";
import { formatStandortText, parseStandortText } from "./index";

describe("parseStandortText", () => {
  it("liest alle Felder einer Zeile", () => {
    const [haus] = parseStandortText(
      "XPENG Center | Kokenhorststraße 2 | 30938 Burgwedel | XPENG | Verkauf, Service | Mo–Fr 9–18, So 11–16 | Kokenhorststraße",
    );
    expect(haus).toMatchObject({
      name: "XPENG Center",
      strasse: "Kokenhorststraße 2",
      plz: "30938",
      ort: "Burgwedel",
      marken: ["XPENG"],
      leistungen: ["Verkauf", "Service"],
      oeffnungszeiten: "Mo–Fr 9–18, So 11–16",
      campus: "Kokenhorststraße",
      vorschlag: null,
    });
  });

  it("kommt mit einem bloßen Namen aus", () => {
    expect(parseStandortText("Autopark")).toEqual([
      expect.objectContaining({ name: "Autopark", marken: [], leistungen: [], plz: null }),
    ]);
  });

  it("überspringt Leerzeilen und Zeilen ohne Namen", () => {
    expect(parseStandortText("\n  \nA\n | nur Straße\n")).toHaveLength(1);
  });

  it("behält einen Ort ohne Postleitzahl", () => {
    expect(parseStandortText("A | | Hannover")[0]).toMatchObject({ plz: null, ort: "Hannover" });
  });

  it("macht aus Schreiben und Lesen eine Runde", () => {
    const text = "A | Weg 1 | 30159 Hannover | SEAT, CUPRA | Verkauf | Mo–Fr 9–18 | Campus | Eigener Text";
    expect(formatStandortText(parseStandortText(text))).toBe(text);
  });
});

describe("parseStandortText: PLZ und Ort", () => {
  it("trennt PLZ und Ort, auch bei mehreren Leerzeichen", () => {
    const [haus] = parseStandortText("Nord | Weg 1 | 30938   Burgwedel");
    expect(haus.plz).toBe("30938");
    expect(haus.ort).toBe("Burgwedel");
  });

  it("nimmt Text ohne PLZ ganz als Ort", () => {
    const [haus] = parseStandortText("Nord | Weg 1 | Burgwedel Mitte");
    expect(haus.plz).toBeNull();
    expect(haus.ort).toBe("Burgwedel Mitte");
  });

  it("bleibt bei sehr vielen Leerzeichen schnell", () => {
    const start = Date.now();
    parseStandortText(`Nord | Weg | 30938${" ".repeat(50000)}x ${" ".repeat(50000)}`);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
