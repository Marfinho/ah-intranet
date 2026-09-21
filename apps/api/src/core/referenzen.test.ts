import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { pruefeReferenz, pruefeReferenzen, type Findbar } from "./referenzen";

/** Steht für ein Prisma-Modell hinter dem mandantengefilterten Client. */
function modell(treffer: { id: string } | null): Findbar & { aufrufe: Record<string, unknown>[] } {
  const aufrufe: Record<string, unknown>[] = [];
  return {
    aufrufe,
    findFirst: vi.fn(async (args) => {
      aufrufe.push(args.where);
      return treffer;
    }),
  };
}

describe("Referenzprüfung", () => {
  it("lässt einen Fremdschlüssel des eigenen Hauses durch", async () => {
    await expect(
      pruefeReferenz({ modell: modell({ id: "l1" }), id: "l1", bezeichnung: "Der Standort" }),
    ).resolves.toBeUndefined();
  });

  it("weist einen Fremdschlüssel ab, den der gefilterte Zugriff nicht findet", async () => {
    await expect(pruefeReferenz({ modell: modell(null), id: "fremd", bezeichnung: "Der Standort" })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("verrät nicht, ob der Datensatz fehlt oder einem anderen Haus gehört", async () => {
    // Eine Unterscheidung wäre ein Orakel zum Erraten fremder Datensätze.
    await expect(pruefeReferenz({ modell: modell(null), id: "x", bezeichnung: "Das Konto" })).rejects.toThrow(
      "Das Konto ist in diesem Autohaus nicht vorhanden.",
    );
  });

  it("überspringt leere Angaben, statt sie abzulehnen", async () => {
    const leer = modell(null);
    await pruefeReferenz({ modell: leer, id: null, bezeichnung: "Der Standort" });
    await pruefeReferenz({ modell: leer, id: undefined, bezeichnung: "Der Standort" });
    await pruefeReferenz({ modell: leer, id: "", bezeichnung: "Der Standort" });
    expect(leer.aufrufe).toHaveLength(0);
  });

  it("nimmt zusätzliche Bedingungen in die Abfrage auf", async () => {
    const konto = modell({ id: "u1" });
    await pruefeReferenz({ modell: konto, id: "u1", bezeichnung: "Das Konto", zusatz: { status: "active" } });
    expect(konto.aufrufe[0]).toEqual({ id: "u1", status: "active" });
  });

  it("prüft mehrere Schlüssel und bricht bei der ersten Abweichung ab", async () => {
    const gut = modell({ id: "a" });
    const schlecht = modell(null);
    const danach = modell({ id: "c" });

    await expect(
      pruefeReferenzen([
        { modell: gut, id: "a", bezeichnung: "Der Standort" },
        { modell: schlecht, id: "b", bezeichnung: "Die Abteilung" },
        { modell: danach, id: "c", bezeichnung: "Das Konto" },
      ]),
    ).rejects.toThrow("Die Abteilung ist in diesem Autohaus nicht vorhanden.");

    expect(danach.aufrufe).toHaveLength(0);
  });
});
