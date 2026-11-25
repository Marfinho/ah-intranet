import { describe, expect, it } from "vitest";
import { planeHausAusLead } from "./haus-vorschau";

const lead = {
  name: "Autohaus Beispiel GmbH",
  anzahlHaeuser: 2,
  anzahlNutzer: 30,
  keyUser: null,
  tier: "prozesse",
  module: [],
  hausId: null,
  kundenStandorte: null,
  standorte: [
    {
      name: "Nord",
      strasse: "Weg 1",
      plz: "28195",
      ort: "Bremen",
      marken: ["Seat"],
      leistungen: ["Verkauf", "Service"],
    },
    { name: "Süd", strasse: null, plz: null, ort: null, marken: [], leistungen: ["Teiledienst"] },
  ],
};

describe("Haus aus Interessent", () => {
  it("leitet Standorte, Abteilungen und Lizenzen aus den Angaben ab", () => {
    const v = planeHausAusLead(lead);
    expect(v.quelle).toBe("betreiber");
    expect(v.plan.standorte.map((s) => s.name)).toEqual(["Nord", "Süd"]);
    expect(v.plan.abteilungen.map((a) => a.code)).toContain("VWL");
    expect(v.lizenzen).toBe(30);
    expect(v.kennung).toBe("beispiel");
  });
  it("Erprobungen bleiben aus, auch im Paket Komplett", () => {
    const v = planeHausAusLead({ ...lead, tier: "komplett" });
    expect(v.moduleZustand.filter((m) => m.enabled && v.modulErprobung.includes(m.key))).toEqual([]);
  });
  it("die Häuser des Interessenten gelten, wenn er sie verändert hat", () => {
    const v = planeHausAusLead({
      ...lead,
      kundenStandorte: [
        { name: "Mitte", adresse: null, marken: [], leistungen: [], oeffnungszeiten: null, campus: null },
      ],
    });
    expect(v.quelle).toBe("interessent");
    expect(v.plan.standorte.map((s) => s.name)).toEqual(["Mitte"]);
  });
  it("meldet ein bereits angelegtes Haus", () => {
    expect(planeHausAusLead({ ...lead, hausId: "h1" }).bereitsAngelegt).toBe(true);
  });
});
