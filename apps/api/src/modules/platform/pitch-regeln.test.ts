import { describe, expect, it } from "vitest";
import {
  hashToken,
  linkGueltigBis,
  linkIstGueltig,
  neuesToken,
  vorschlagFuerStandort,
  type StandortAngabe,
} from "./pitch-regeln";

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

describe("Link", () => {
  it("erzeugt unterschiedliche, lange Token", () => {
    const a = neuesToken();
    expect(a).not.toBe(neuesToken());
    expect(a.length).toBeGreaterThanOrEqual(43);
  });

  it("hasht stabil und gibt den Klartext nicht preis", () => {
    const token = neuesToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).toHaveLength(64);
  });

  it("begrenzt die Gültigkeit", () => {
    const jetzt = new Date("2026-01-01T00:00:00Z");
    expect(linkGueltigBis(60, jetzt).toISOString()).toBe("2026-03-02T00:00:00.000Z");
    expect(linkGueltigBis(100000, jetzt).getTime() - jetzt.getTime()).toBe(365 * 86400000);
    expect(linkGueltigBis(0, jetzt).getTime() - jetzt.getTime()).toBe(86400000);
  });

  it("lehnt abgelaufene und widerrufene Links ab", () => {
    const jetzt = new Date("2026-06-01T00:00:00Z");
    expect(linkIstGueltig({ tokenGueltigBis: new Date("2026-07-01"), tokenWiderrufenAm: null }, jetzt)).toBe(true);
    expect(linkIstGueltig({ tokenGueltigBis: new Date("2026-05-01"), tokenWiderrufenAm: null }, jetzt)).toBe(false);
    expect(
      linkIstGueltig({ tokenGueltigBis: new Date("2026-07-01"), tokenWiderrufenAm: new Date("2026-05-01") }, jetzt),
    ).toBe(false);
  });
});
