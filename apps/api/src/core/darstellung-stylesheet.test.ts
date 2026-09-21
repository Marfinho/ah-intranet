import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DARSTELLUNG_DEFINITIONS } from "@ah-intranet/shared";

/**
 * Hält die Voreinstellungen der Darstellung am Stylesheet.
 *
 * Eine Voreinstellung ohne eigenen Block sähe exakt aus wie der Standard: die
 * Auswahl im Profil ließe sich speichern und bewirkte nichts. Der Standard
 * selbst braucht keinen Block - er *ist* `:root`.
 */
const WURZEL = join(__dirname, "..", "..", "..", "..");
const CSS = readFileSync(join(WURZEL, "apps", "web", "app", "globals.css"), "utf-8");

describe("Darstellung im Stylesheet", () => {
  it("hat zu jeder Voreinstellung außer dem Standard einen Block", () => {
    for (const eintrag of DARSTELLUNG_DEFINITIONS) {
      if (eintrag.key === "standard") {
        continue;
      }
      expect(CSS).toContain(`[data-darstellung="${eintrag.key}"]`);
    }
  });

  it("legt jede Stufe der Grauskala und der Markenfarbe als Variable fest", () => {
    for (const stufe of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      expect(CSS).toContain(`--ahoi-slate-${stufe}:`);
      expect(CSS).toContain(`--ahoi-brand-${stufe}:`);
    }
  });
});
