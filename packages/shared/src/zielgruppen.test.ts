import { describe, expect, it } from "vitest";
import {
  GLOBAL_SCOPE,
  ZIELGRUPPEN_STUFEN,
  eigeneZielgruppen,
  istBekannteZielgruppe,
  parseZielgruppe,
  zielgruppeLabel,
  zielgruppenLabel,
  zielgruppenToken,
} from "./index";

const KATALOG = {
  eintraege: [
    { stufe: "location" as const, code: "HB", name: "Hauptbetrieb Bremen" },
    { stufe: "location" as const, code: "DEL", name: "Filiale Delmenhorst" },
    { stufe: "department" as const, code: "SRV", name: "Service & Werkstatt" },
    { stufe: "specialty" as const, code: "EMOB", name: "Elektromobilität" },
  ],
};

describe("Zielgruppen-Token", () => {
  it("hält die Reihenfolge der Kaskade ein, egal wie die Teile hereinkommen", () => {
    expect(zielgruppenToken({ department: "SRV", location: "HB" })).toBe("location:HB+department:SRV");
    expect(zielgruppenToken({ specialty: "EMOB", location: "HB" })).toBe("location:HB+specialty:EMOB");
  });

  it("ist ohne Teile die ganze Gruppe", () => {
    expect(zielgruppenToken({})).toBe(GLOBAL_SCOPE);
  });

  it("liest zurück, was es geschrieben hat", () => {
    const zielgruppe = { location: "HB", department: "SRV" };
    expect(parseZielgruppe(zielgruppenToken(zielgruppe))).toEqual(zielgruppe);
    expect(parseZielgruppe(GLOBAL_SCOPE)).toEqual({});
  });

  it("weist verdrehte, doppelte und kaputte Tokens ab", () => {
    // Verdreht wäre ein zweites Token für dieselbe Zielgruppe - und eines der
    // beiden träfe niemanden.
    expect(parseZielgruppe("department:SRV+location:HB")).toBeNull();
    expect(parseZielgruppe("location:HB+location:DEL")).toBeNull();
    expect(parseZielgruppe("abteilung:SRV")).toBeNull();
    expect(parseZielgruppe("location:")).toBeNull();
    expect(parseZielgruppe("")).toBeNull();
  });
});

describe("Eigene Zielgruppen eines Kontos", () => {
  it("enthält jede Stufe einzeln und jede Kombination", () => {
    const scopes = eigeneZielgruppen({ locationCode: "HB", departmentCode: "SRV", specialtyCode: "EMOB" });
    expect(scopes).toEqual(
      expect.arrayContaining([
        GLOBAL_SCOPE,
        "location:HB",
        "department:SRV",
        "specialty:EMOB",
        "location:HB+department:SRV",
        "location:HB+specialty:EMOB",
        "department:SRV+specialty:EMOB",
        "location:HB+department:SRV+specialty:EMOB",
      ]),
    );
    expect(scopes).toHaveLength(8);
    expect(new Set(scopes).size).toBe(scopes.length);
  });

  it("bleibt bei einem Konto ohne Stammdaten auf der ganzen Gruppe", () => {
    expect(eigeneZielgruppen({})).toEqual([GLOBAL_SCOPE]);
  });

  /**
   * Der eigentliche Zweck des Schnitts: „Service in Bremen" erreicht die
   * Serviceleute in Bremen, aber weder den Service in Delmenhorst noch den
   * Verkauf in Bremen.
   */
  it("trifft mit dem Schnitt genau ein Haus und eine Abteilung", () => {
    const ziel = "location:HB+department:SRV";
    const serviceBremen = eigeneZielgruppen({ locationCode: "HB", departmentCode: "SRV" });
    const serviceDelmenhorst = eigeneZielgruppen({ locationCode: "DEL", departmentCode: "SRV" });
    const verkaufBremen = eigeneZielgruppen({ locationCode: "HB", departmentCode: "VKN" });

    expect(serviceBremen).toContain(ziel);
    expect(serviceDelmenhorst).not.toContain(ziel);
    expect(verkaufBremen).not.toContain(ziel);
  });

  it("erreicht mit der Abteilung allein jedes Haus", () => {
    for (const haus of ["HB", "DEL"]) {
      expect(eigeneZielgruppen({ locationCode: haus, departmentCode: "SRV" })).toContain("department:SRV");
    }
  });
});

describe("Prüfung gegen die Stammdaten", () => {
  it("erkennt bekannte Zielgruppen", () => {
    expect(istBekannteZielgruppe(GLOBAL_SCOPE, KATALOG)).toBe(true);
    expect(istBekannteZielgruppe("location:HB+department:SRV", KATALOG)).toBe(true);
  });

  it("weist erfundene Codes ab", () => {
    expect(istBekannteZielgruppe("location:XXX", KATALOG)).toBe(false);
    expect(istBekannteZielgruppe("location:HB+department:XXX", KATALOG)).toBe(false);
  });
});

describe("Anzeige", () => {
  it("nennt die Zielgruppe in Klartext", () => {
    expect(zielgruppeLabel("location:HB+department:SRV", KATALOG)).toBe("Hauptbetrieb Bremen · Service & Werkstatt");
    expect(zielgruppeLabel(GLOBAL_SCOPE, KATALOG)).toBe("Alle Mitarbeitenden");
  });

  it("zeigt gelöschte Stammdaten als Code statt als Lücke", () => {
    expect(zielgruppeLabel("department:WEG", KATALOG)).toBe("Abteilung WEG");
  });

  it("fasst mehrere Zielgruppen zusammen und lässt 'global' alles schlucken", () => {
    expect(zielgruppenLabel(["location:HB", "location:DEL"], KATALOG)).toBe(
      "Hauptbetrieb Bremen | Filiale Delmenhorst",
    );
    expect(zielgruppenLabel(["location:HB", GLOBAL_SCOPE], KATALOG)).toBe("Alle Mitarbeitenden");
    expect(zielgruppenLabel([], KATALOG)).toBe("Alle Mitarbeitenden");
  });
});

describe("Stufen", () => {
  it("führt die Kaskade von grob nach fein", () => {
    expect([...ZIELGRUPPEN_STUFEN]).toEqual(["location", "department", "specialty"]);
  });
});
