import { describe, expect, it } from "vitest";
import {
  abschlussquote,
  aktiveModule,
  anteil,
  fuelleTage,
  hausHinweise,
  leadHinweise,
  lizenzAuslastung,
  modulAenderung,
} from "./regeln";

const haus = {
  id: "h1",
  name: "Haus",
  isActive: true,
  aktiveKonten: 10,
  licensedSeats: 100 as number | null,
  locationLimit: null as number | null,
  standorte: 1,
  letzteAnmeldung: new Date("2026-11-24"),
  mfaPflicht: false,
  createdAt: new Date("2026-01-01"),
};
const jetzt = new Date("2026-11-25T12:00:00Z");

describe("Anteile", () => {
  it("rundet auf eine Stelle und kennt keine Division durch null", () => {
    expect(anteil(1, 3)).toBe(33.3);
    expect(anteil(1, 0)).toBeNull();
  });
  it("Auslastung ohne Kontingent ist unbestimmt, nicht null Prozent", () => {
    expect(lizenzAuslastung(5, null)).toBeNull();
    expect(lizenzAuslastung(5, 10)).toBe(50);
  });
});

describe("Module", () => {
  it("ohne gespeicherte Zeilen gilt die Vorgabe, Kernmodule sind immer an", () => {
    const an = aktiveModule([]);
    expect(an).toContain("dashboard");
  });
  it("Beta-Module sind ohne Zeile aus, mit Zeile an", () => {
    const beta = aktiveModule([{ key: "shifts", enabled: true }]);
    expect(beta.includes("shifts")).toBe(true);
    expect(aktiveModule([]).includes("shifts")).toBe(false);
  });
  it("Ausschalten nimmt abhängige Module mit, Einschalten zieht Vormodule nach", () => {
    expect(modulAenderung("orders", false).get("approvals")).toBe(false);
    expect(modulAenderung("approvals", true).get("orders")).toBe(true);
  });
});

describe("Tagesreihen", () => {
  it("füllt Lücken mit 0 und endet heute", () => {
    const reihe = fuelleTage([{ tag: "2026-11-24", n: 4 }], 3, jetzt);
    expect(reihe).toEqual([
      { tag: "2026-11-23", n: 0 },
      { tag: "2026-11-24", n: 4 },
      { tag: "2026-11-25", n: 0 },
    ]);
  });
});

describe("Hinweise", () => {
  it("meldet erschöpftes Kontingent kritisch, 90 % als Warnung", () => {
    expect(hausHinweise({ ...haus, aktiveKonten: 100 }, jetzt)[0]?.stufe).toBe("kritisch");
    expect(hausHinweise({ ...haus, aktiveKonten: 92 }, jetzt)[0]?.stufe).toBe("warnung");
    expect(hausHinweise(haus, jetzt)).toEqual([]);
  });
  it("ein gesperrtes Haus bekommt nur den Sperrhinweis", () => {
    expect(hausHinweise({ ...haus, isActive: false, aktiveKonten: 100 }, jetzt)).toHaveLength(1);
  });
  it("meldet ruhende Häuser und solche ohne je eine Anmeldung", () => {
    expect(hausHinweise({ ...haus, letzteAnmeldung: new Date("2026-09-01") }, jetzt)).toHaveLength(1);
    expect(hausHinweise({ ...haus, letzteAnmeldung: null }, jetzt)).toHaveLength(1);
    expect(hausHinweise({ ...haus, letzteAnmeldung: null, createdAt: new Date("2026-11-24") }, jetzt)).toEqual([]);
  });
  it("Interessenten: unbearbeitete Anfrage und auslaufender Link", () => {
    const lead = {
      id: "l",
      name: "L",
      status: "angefragt",
      angefragtAm: new Date("2026-11-20"),
      updatedAt: jetzt,
      tokenGueltigBis: new Date("2027-01-01"),
      tokenWiderrufenAm: null,
    };
    expect(leadHinweise(lead, jetzt)[0]?.stufe).toBe("kritisch");
    const bald = { ...lead, status: "versendet", tokenGueltigBis: new Date("2026-11-28") };
    expect(leadHinweise(bald, jetzt)[0]?.stufe).toBe("warnung");
    expect(leadHinweise({ ...bald, tokenWiderrufenAm: jetzt }, jetzt)).toEqual([]);
  });
});

describe("Abschlussquote", () => {
  it("zählt nur Entschiedene", () => {
    expect(
      abschlussquote([
        { status: "gewonnen", anzahl: 1 },
        { status: "verloren", anzahl: 3 },
        { status: "entwurf", anzahl: 50 },
      ]),
    ).toBe(25);
    expect(abschlussquote([{ status: "entwurf", anzahl: 2 }])).toBeNull();
  });
});
