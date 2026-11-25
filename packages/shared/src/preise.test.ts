import { describe, expect, it } from "vitest";
import {
  MODULE_DEFINITIONS,
  TIERS,
  berechneAngebot,
  effektiveModule,
  getModule,
  waehlbareModule,
  vorgabeKeyUser,
} from "./index";

/**
 * Die Preisliste ist Geschäftslogik mit Geld daran. Diese Prüfungen halten die
 * Zusagen fest, die der Pitch macht: ein Tier ist nie teurer als dieselben
 * Module einzeln, und die Rechnung für das Referenzhaus ist nachrechenbar.
 */
describe("Tiers", () => {
  it("bauen aufeinander auf", () => {
    for (let i = 1; i < TIERS.length; i += 1) {
      for (const key of TIERS[i - 1].module) {
        expect(TIERS[i].module).toContain(key);
      }
    }
  });

  it("kennen nur Module der Registry", () => {
    for (const tier of TIERS) {
      for (const key of tier.module) {
        expect(getModule(key)).toBeDefined();
      }
    }
  });

  it("enthalten alle Kernmodule", () => {
    const kern = MODULE_DEFINITIONS.filter((modul) => modul.core).map((modul) => modul.key as string);
    for (const tier of TIERS) {
      for (const key of kern) {
        expect(tier.module).toContain(key);
      }
    }
  });

  it("lösen Abhängigkeiten innerhalb des Tiers", () => {
    for (const tier of TIERS) {
      for (const key of tier.module) {
        for (const abhaengig of getModule(key)?.dependsOn ?? []) {
          expect(tier.module).toContain(abhaengig);
        }
      }
    }
  });

  it("geben dem zweiten Tier die Hälfte der Module und dem dritten alle", () => {
    expect(TIERS[1].module.length).toBe(MODULE_DEFINITIONS.length / 2);
    expect(TIERS[2].module.length).toBe(MODULE_DEFINITIONS.length);
  });

  it("steigen im Preis", () => {
    expect(TIERS.map((tier) => tier.basisCent)).toEqual([5000, 10000, 15000]);
    expect(TIERS.map((tier) => tier.nutzerCent)).toEqual([75, 150, 300]);
  });
});

describe("Vorteil des Tiers gegenüber Einzelmodulen", () => {
  it("gilt für jede Nutzerzahl", () => {
    for (const tier of TIERS) {
      for (const nutzer of [1, 2, 10, 25, 100, 280, 1000, 5000]) {
        const angebot = berechneAngebot({ haeuser: 1, nutzer, tier: tier.key });
        expect(angebot.ersparnisCent, `${tier.key} bei ${nutzer} Nutzern`).toBeGreaterThanOrEqual(0);
        expect(angebot.einzelpreisCent).toBeGreaterThanOrEqual(angebot.monatlich.summeCent);
      }
    }
  });

  it("ist bei größeren Häusern deutlich", () => {
    const angebot = berechneAngebot({ haeuser: 8, nutzer: 280, tier: "prozesse" });
    expect(angebot.ersparnisCent).toBeGreaterThan(angebot.monatlich.summeCent / 5);
  });
});

describe("berechneAngebot, Referenzfall Hackerott (8 Häuser, 280 Nutzer)", () => {
  const rechne = (tier: "basis" | "prozesse" | "komplett") => berechneAngebot({ haeuser: 8, nutzer: 280, tier });

  it("rechnet die Monatspreise der drei Tiers", () => {
    expect(rechne("basis").monatlich.summeCent).toBe(26000);
    expect(rechne("prozesse").monatlich.summeCent).toBe(52000);
    expect(rechne("komplett").monatlich.summeCent).toBe(99000);
  });

  it("rechnet das Jahr", () => {
    expect(rechne("prozesse").jahrCent).toBe(624000);
  });

  it("rechnet Einrichtung und Schulung einmalig", () => {
    const angebot = rechne("prozesse");
    expect(angebot.keyUser).toBe(12);
    expect(angebot.einmalig.summeCent).toBe(150000 + 7 * 25000 + 2 * 100000);
  });
});

describe("Einzelwahl", () => {
  it("rechnet Basispreis plus Module", () => {
    // Aktuelles + Dokumente bei 100 Nutzern: 50 + 2 × (10 + 100 × 0,25) = 120 €
    const angebot = berechneAngebot({ haeuser: 1, nutzer: 100, tier: null, module: ["news", "documents"] });
    expect(angebot.modus).toBe("auswahl");
    expect(angebot.monatlich.summeCent).toBe(5000 + 2 * (1000 + 2500));
  });

  it("zieht Abhängigkeiten nach", () => {
    expect(effektiveModule(["approvals"])).toContain("orders");
    const angebot = berechneAngebot({ haeuser: 1, nutzer: 10, tier: null, module: ["approvals"] });
    const zeilen = angebot.monatlich.zeilen.map((zeile) => zeile.text);
    expect(zeilen).toContain("Bestellungen");
    expect(zeilen).toContain("Freigaben");
  });

  it("nimmt Kernmodule immer mit und berechnet sie nicht einzeln", () => {
    const angebot = berechneAngebot({ haeuser: 1, nutzer: 10, tier: null, module: [] });
    expect(angebot.module).toEqual(expect.arrayContaining(["dashboard", "notifications", "admin"]));
    expect(angebot.monatlich.summeCent).toBe(5000);
  });

  it("lässt Erprobungen und Unbekanntes nicht zu", () => {
    const module = effektiveModule(["shifts", "custody", "meals", "gibt-es-nicht"]);
    expect(module).not.toContain("shifts");
    expect(module).not.toContain("custody");
    expect(module).not.toContain("meals");
    expect(module).not.toContain("gibt-es-nicht");
  });

  it("wählt nur wählbare Module an", () => {
    for (const modul of waehlbareModule()) {
      expect(modul.core).toBe(false);
      expect(modul.stage).toBe("stabil");
    }
  });

  it("empfiehlt ein Tier, wenn es mehr enthält und weniger kostet", () => {
    const alle = TIERS[1].module.filter((key) => !getModule(key)?.core);
    const angebot = berechneAngebot({ haeuser: 1, nutzer: 100, tier: null, module: alle });
    expect(angebot.empfehlung?.tier).toBe("prozesse");
    expect(angebot.empfehlung?.ersparnisCent).toBe(angebot.monatlich.summeCent - angebot.empfehlung!.monatlichCent);
  });

  it("empfiehlt nichts, wenn die Einzelwahl günstiger ist", () => {
    const angebot = berechneAngebot({ haeuser: 1, nutzer: 100, tier: null, module: ["news"] });
    expect(angebot.empfehlung).toBeNull();
  });

  it("richtet die Einrichtung nach dem Umfang", () => {
    const klein = berechneAngebot({ haeuser: 1, nutzer: 10, tier: null, module: [] });
    const gross = berechneAngebot({
      haeuser: 1,
      nutzer: 10,
      tier: null,
      module: waehlbareModule().map((modul) => modul.key),
    });
    expect(klein.einmalig.zeilen[0].cent).toBe(TIERS[0].einrichtungCent);
    expect(gross.einmalig.zeilen[0].cent).toBe(TIERS[2].einrichtungCent);
  });
});

describe("Eingaben", () => {
  it("hält Häuser und Nutzer in sinnvollen Grenzen", () => {
    const angebot = berechneAngebot({ haeuser: -3, nutzer: Number.NaN, tier: "basis" });
    expect(angebot.haeuser).toBe(1);
    expect(angebot.nutzer).toBe(1);
  });

  it("rundet Bruchteile ab", () => {
    expect(berechneAngebot({ haeuser: 2.9, nutzer: 10.7, tier: "basis" }).nutzer).toBe(10);
  });

  it("nimmt anderthalb Key-User je Haus an", () => {
    expect(vorgabeKeyUser(8)).toBe(12);
    expect(vorgabeKeyUser(1)).toBe(2);
  });

  it("rechnet jeden angefangenen Schulungstermin", () => {
    expect(berechneAngebot({ haeuser: 1, nutzer: 5, keyUser: 6, tier: "basis" }).einmalig.zeilen[1].cent).toBe(100000);
    expect(berechneAngebot({ haeuser: 1, nutzer: 5, keyUser: 7, tier: "basis" }).einmalig.zeilen[1].cent).toBe(200000);
  });
});
