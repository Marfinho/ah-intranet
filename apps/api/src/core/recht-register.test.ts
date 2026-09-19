import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULE_DEFINITIONS, RETENTION_RULES } from "@ah-intranet/shared";

/**
 * Hält das Rechtsregister an der Registry.
 *
 * Ein neues Modul bringt neue Daten über Menschen. Steht es nicht in
 * `docs/recht.md`, schaltet ein Haus es ein, ohne zu wissen, worauf es sich
 * einlässt - und das fällt erst auf, wenn jemand fragt. Dieser Test macht das
 * Vergessen unmöglich.
 */
const WURZEL = join(__dirname, "..", "..", "..", "..");
const REGISTER = readFileSync(join(WURZEL, "docs", "recht.md"), "utf-8");

describe("Rechtsregister", () => {
  it("führt jedes Modul der Registry auf", () => {
    const fehlend = MODULE_DEFINITIONS.filter((modul) => !REGISTER.includes(modul.label));
    expect(fehlend.map((modul) => `${modul.key} (${modul.label})`)).toEqual([]);
  });

  it("führt jede Aufbewahrungsfrist auf", () => {
    const fehlend = RETENTION_RULES.filter((regel) => !REGISTER.includes(regel.label));
    expect(fehlend.map((regel) => regel.key)).toEqual([]);
  });

  it("benennt die besonderen Kategorien, die das Datenmodell zulässt", () => {
    // Krankmeldung, Ernährung und nicht anonyme Umfragen sind die drei Stellen,
    // an denen Artikel 9 ins Spiel kommt. Wer sie aus dem Register nimmt,
    // nimmt die Warnung heraus.
    for (const stichwort of ["Art. 9", "krank", "nicht anonym", "§ 5 ArbZG"]) {
      expect(REGISTER).toContain(stichwort);
    }
  });

  it("weist sich selbst als Vorarbeit aus, nicht als Rechtsrat", () => {
    expect(REGISTER).toContain("Kein Rechtsrat");
  });
});
