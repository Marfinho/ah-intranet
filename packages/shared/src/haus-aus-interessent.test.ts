import { describe, expect, it } from "vitest";
import { kuerzel, modulEinstellungen, planeHaus, vorschlagKennung } from "./haus-aus-interessent";

describe("kuerzel", () => {
  it("nimmt bei mehreren Wörtern die Anfangsbuchstaben", () => {
    expect(kuerzel("Autopark Hannover", new Set())).toBe("AH");
  });

  it("nimmt bei einem Wort die ersten Buchstaben und entfernt Akzente", () => {
    expect(kuerzel("Škoda", new Set(), 5)).toBe("SKODA");
    expect(kuerzel("Lotus", new Set())).toBe("LOT");
  });

  it("hängt eine Ziffer an, wenn das Kürzel vergeben ist", () => {
    const vergeben = new Set<string>();
    expect(kuerzel("Autopark Laatzen", vergeben)).toBe("AL");
    expect(kuerzel("Autohaus Langenhagen", vergeben)).toBe("AL2");
    expect(kuerzel("Autohaus Lehrte", vergeben)).toBe("AL3");
  });
});

describe("planeHaus", () => {
  const haeuser = [
    {
      name: "Autopark Hannover",
      strasse: "Schulenburger Landstraße 73",
      plz: "30165",
      ort: "Hannover",
      marken: ["SEAT", "CUPRA"],
      leistungen: ["Verkauf", "Service", "Teiledienst"],
    },
    { name: "CUPRA GARAGE City", marken: ["CUPRA"], leistungen: ["Verkauf"] },
    { name: "Autopark Hannover", marken: [], leistungen: [] },
  ];
  const plan = planeHaus(haeuser);

  it("legt jeden Standort an, auch bei doppeltem Namen", () => {
    expect(plan.standorte.map((standort) => standort.name)).toEqual([
      "Autopark Hannover",
      "CUPRA GARAGE City",
      "Autopark Hannover (2)",
    ]);
  });

  it("vergibt eindeutige Standortkürzel", () => {
    const codes = plan.standorte.map((standort) => standort.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("legt jede Marke einmal an, auch wenn mehrere Häuser sie führen", () => {
    expect(plan.marken.map((marke) => marke.name)).toEqual(["SEAT", "CUPRA"]);
    expect(plan.standorte[1].marken).toEqual([plan.marken[1].code]);
  });

  it("macht aus Leistungen Abteilungen mit den bekannten Kürzeln", () => {
    const codes = Object.fromEntries(plan.abteilungen.map((abteilung) => [abteilung.name, abteilung.code]));
    expect(codes).toMatchObject({ Verwaltung: "VWL", Verkauf: "VKF", Service: "SRV", Teiledienst: "TLD" });
  });

  it("ordnet dem ersten Standort die Verwaltung zu", () => {
    expect(plan.standorte[0].abteilungen).toContain("VWL");
    expect(plan.standorte[1].abteilungen).not.toContain("VWL");
  });

  it("übernimmt die Adresse", () => {
    expect(plan.standorte[0].adresse).toBe("Schulenburger Landstraße 73, 30165 Hannover");
    expect(plan.standorte[1].adresse).toBeNull();
  });
});

describe("modulEinstellungen", () => {
  it("schaltet gewählte stabile Module ein und die übrigen aus", () => {
    const einstellungen = Object.fromEntries(modulEinstellungen(["news", "orders"]).map((e) => [e.key, e.enabled]));
    expect(einstellungen.news).toBe(true);
    expect(einstellungen.orders).toBe(true);
    expect(einstellungen.tickets).toBe(false);
  });

  it("lässt Erprobungen aus, auch wenn sie gewählt sind", () => {
    const einstellungen = Object.fromEntries(
      modulEinstellungen(["shifts", "custody", "meals"]).map((e) => [e.key, e.enabled]),
    );
    expect(einstellungen).toMatchObject({ shifts: false, custody: false, meals: false });
  });

  it("führt keine Kernmodule auf", () => {
    const keys = modulEinstellungen([]).map((e) => e.key);
    expect(keys).not.toContain("dashboard");
    expect(keys).not.toContain("admin");
  });
});

describe("vorschlagKennung", () => {
  it("macht aus einem Namen eine gültige Kennung", () => {
    expect(vorschlagKennung("HACKEROTT Autohaus Gruppe")).toBe("hackerott");
    expect(vorschlagKennung("Müller & Söhne GmbH")).toBe("muller-sohne");
  });

  it("liefert nichts, wenn keine gültige Kennung daraus wird", () => {
    expect(vorschlagKennung("GmbH")).toBeNull();
  });
});
