import { describe, expect, it } from "vitest";
import {
  KUNDEN_HAEUSER_MAX,
  bereinigeKundenStandorte,
  istSonntagsgeoeffnet,
  mitSonntag,
  vorschlagFuerStandort,
  type StandortAngabe,
} from "./index";

const haus = (teil: Partial<StandortAngabe> & { name: string }): StandortAngabe => ({
  marken: [],
  leistungen: [],
  ...teil,
});

describe("vorschlagFuerStandort", () => {
  it("schlägt Aktuelles immer vor", () => {
    expect(vorschlagFuerStandort(haus({ name: "A" }), []).module).toContain("news");
  });

  it("gibt einem Haus mit Service Serviceanfragen sowie Bestellungen mit Freigabe", () => {
    const vorschlag = vorschlagFuerStandort(haus({ name: "A", leistungen: ["Verkauf", "Service"] }), []);
    expect(vorschlag.module).toEqual(expect.arrayContaining(["tickets", "orders", "approvals"]));
  });

  it("legt in jedem Haus die Grundlage an", () => {
    for (const standort of [haus({ name: "A" }), haus({ name: "B", leistungen: ["Service"] })]) {
      expect(vorschlagFuerStandort(standort, []).module).toEqual(
        expect.arrayContaining(["news", "directory", "documents", "quicklinks", "absences"]),
      );
    }
  });

  it("schlägt Freigaben nie ohne Bestellungen vor", () => {
    const alle = [haus({ name: "A" }), haus({ name: "B", leistungen: ["Service"] })];
    for (const standort of alle) {
      const { module } = vorschlagFuerStandort(standort, alle);
      if (module.includes("approvals")) expect(module).toContain("orders");
    }
  });

  it("gibt einem reinen Verkaufshaus keine Bestellungen", () => {
    const vorschlag = vorschlagFuerStandort(haus({ name: "City", leistungen: ["Verkauf"] }), []);
    expect(vorschlag.module).toContain("tickets");
    expect(vorschlag.module).not.toContain("orders");
    expect(vorschlag.text).toContain("Ohne eigene Werkstatt");
  });

  it("erkennt Häuser desselben Campus und nennt die Nachbarn", () => {
    const a = haus({ name: "Autopark", campus: "Kokenhorststraße" });
    const b = haus({ name: "XPENG Center", campus: "Kokenhorststraße" });
    const c = haus({ name: "Laatzen", campus: "Laatzen" });
    const vorschlag = vorschlagFuerStandort(a, [a, b, c]);
    expect(vorschlag.module).toEqual(expect.arrayContaining(["rooms", "calendar", "directory"]));
    expect(vorschlag.text).toContain("XPENG Center");
    expect(vorschlag.text).not.toContain("Laatzen");
  });

  it("schlägt keinen Verbund vor, wenn das Haus allein steht", () => {
    const a = haus({ name: "A", campus: "Eigen" });
    expect(vorschlagFuerStandort(a, [a]).module).not.toContain("rooms");
  });

  it("schlägt bei Sonntagsöffnung den Schichtplan vor", () => {
    const vorschlag = vorschlagFuerStandort(
      haus({ name: "X", oeffnungszeiten: "Mo–Fr 9–18, So Schautag 11–16 Uhr" }),
      [],
    );
    expect(vorschlag.module).toContain("shifts");
    expect(vorschlag.text).toContain("Erprobung");
  });

  it("verwechselt Samstag und Sonntag nicht", () => {
    const vorschlag = vorschlagFuerStandort(haus({ name: "X", oeffnungszeiten: "Mo–Fr 9–18, Sa 9–14 Uhr" }), []);
    expect(vorschlag.module).not.toContain("shifts");
  });

  it("schlägt für ein Gebrauchtwagenhaus Fundsachen & Schlüssel vor", () => {
    const vorschlag = vorschlagFuerStandort(haus({ name: "Gebrauchtwagenzentrum" }), []);
    expect(vorschlag.module).toContain("custody");
    expect(vorschlag.text).toContain("DMS");
  });

  it("nennt kein Modul doppelt", () => {
    const vorschlag = vorschlagFuerStandort(haus({ name: "A", leistungen: ["Service", "Werkstatt"] }), []);
    expect(new Set(vorschlag.module).size).toBe(vorschlag.module.length);
  });
});

describe("mitSonntag", () => {
  it("hängt den Sonntag an, ohne die übrigen Zeiten anzufassen", () => {
    expect(mitSonntag("Mo–Fr 9–18, Sa 9–14 Uhr", true)).toBe("Mo–Fr 9–18, Sa 9–14 Uhr, So 11–16 Uhr");
  });

  it("legt einen vorhandenen Sonntag nicht doppelt an", () => {
    expect(mitSonntag("Mo–Fr 9–18, So Schautag 11–16 Uhr", true)).toBe("Mo–Fr 9–18, So Schautag 11–16 Uhr");
  });

  it("nimmt den Sonntag heraus und lässt den Rest stehen", () => {
    expect(mitSonntag("Mo–Fr 9–18, Sa 9–14 Uhr, So Schautag 11–16 Uhr", false)).toBe("Mo–Fr 9–18, Sa 9–14 Uhr");
  });

  it("kommt mit leeren Zeiten aus", () => {
    expect(mitSonntag(null, true)).toBe("So 11–16 Uhr");
    expect(mitSonntag(null, false)).toBeNull();
    expect(mitSonntag("So 11–16 Uhr", false)).toBeNull();
  });

  it("stimmt mit der Erkennung überein", () => {
    expect(istSonntagsgeoeffnet(mitSonntag("Mo–Fr 9–18", true))).toBe(true);
    expect(istSonntagsgeoeffnet(mitSonntag("Mo–Fr 9–18, So 11–16", false))).toBe(false);
  });
});

describe("bereinigeKundenStandorte", () => {
  const eingabe = (teil: Partial<ReturnType<typeof bereinigeKundenStandorte>[number]> = {}) => ({
    name: "Haus",
    adresse: null,
    marken: [],
    leistungen: [],
    oeffnungszeiten: null,
    campus: null,
    ...teil,
  });

  it("verwirft Häuser ohne Namen", () => {
    expect(bereinigeKundenStandorte([eingabe({ name: "  " }), eingabe({ name: "A" })]).map((h) => h.name)).toEqual([
      "A",
    ]);
  });

  it("kürzt und dedupliziert Listen", () => {
    const [haus] = bereinigeKundenStandorte([eingabe({ marken: [" SEAT ", "SEAT", "", "CUPRA"] })]);
    expect(haus.marken).toEqual(["SEAT", "CUPRA"]);
  });

  it("begrenzt Länge und Anzahl", () => {
    const [haus] = bereinigeKundenStandorte([
      eingabe({ name: "x".repeat(500), marken: Array.from({ length: 50 }, (_, i) => `M${i}`) }),
    ]);
    expect(haus.name).toHaveLength(120);
    expect(haus.marken).toHaveLength(20);
    expect(bereinigeKundenStandorte(Array.from({ length: KUNDEN_HAEUSER_MAX + 50 }, () => eingabe()))).toHaveLength(
      KUNDEN_HAEUSER_MAX,
    );
  });

  it("macht aus leeren Texten null", () => {
    const [haus] = bereinigeKundenStandorte([eingabe({ campus: "  ", oeffnungszeiten: "" })]);
    expect(haus.campus).toBeNull();
    expect(haus.oeffnungszeiten).toBeNull();
  });
});
