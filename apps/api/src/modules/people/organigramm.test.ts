import { describe, expect, it } from "vitest";
import { alleUnterstellten, baueBaum, vorgesetztenKette, wuerdeKreisBilden } from "./organigramm";

// GF <- Leitung <- (A, B); B <- C
const personen = [
  { id: "gf", managerId: null },
  { id: "leitung", managerId: "gf" },
  { id: "a", managerId: "leitung" },
  { id: "b", managerId: "leitung" },
  { id: "c", managerId: "b" },
];

describe("wuerdeKreisBilden", () => {
  it("erkennt die eigene Person als Vorgesetzte", () => {
    expect(wuerdeKreisBilden(personen, "a", "a")).toBe(true);
  });

  it("erkennt einen mittelbaren Kreis", () => {
    // GF unter C zu hängen schlösse die Kette GF -> Leitung -> B -> C -> GF.
    expect(wuerdeKreisBilden(personen, "gf", "c")).toBe(true);
  });

  it("lässt eine gültige Umhängung zu", () => {
    expect(wuerdeKreisBilden(personen, "c", "a")).toBe(false);
  });
});

describe("baueBaum", () => {
  it("hängt Personen unter ihre Vorgesetzten", () => {
    const [wurzel] = baueBaum(personen);
    expect(wurzel.person.id).toBe("gf");
    expect(wurzel.unterstellte[0].unterstellte.map((k) => k.person.id)).toEqual(["a", "b"]);
  });

  it("macht Personen mit fehlender Vorgesetzter zur Wurzel, statt sie zu verlieren", () => {
    const baum = baueBaum([...personen, { id: "waise", managerId: "gibt-es-nicht" }]);
    expect(baum.map((k) => k.person.id)).toContain("waise");
  });
});

describe("alleUnterstellten", () => {
  it("liefert auch mittelbar Unterstellte, nicht die Person selbst", () => {
    expect(alleUnterstellten(personen, "leitung").sort()).toEqual(["a", "b", "c"]);
  });

  it("ist für Personen ohne Unterstellte leer", () => {
    expect(alleUnterstellten(personen, "c")).toEqual([]);
  });

  it("bleibt bei kaputten Daten mit Kreis nicht hängen", () => {
    const kaputt = [
      { id: "x", managerId: "y" },
      { id: "y", managerId: "x" },
    ];
    expect(alleUnterstellten(kaputt, "x")).toEqual(["y"]);
  });
});

describe("vorgesetztenKette", () => {
  it("läuft von der nächsten Vorgesetzten nach oben", () => {
    expect(vorgesetztenKette(personen, "c")).toEqual(["b", "leitung", "gf"]);
  });

  it("endet bei kaputten Daten mit Kreis", () => {
    const kaputt = [
      { id: "x", managerId: "y" },
      { id: "y", managerId: "x" },
    ];
    expect(vorgesetztenKette(kaputt, "x")).toEqual(["y"]);
  });
});
