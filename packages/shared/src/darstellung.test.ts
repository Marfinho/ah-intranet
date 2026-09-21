import { describe, expect, it } from "vitest";
import { DARSTELLUNG_DEFINITIONS, DARSTELLUNG_KEYS, istDarstellung } from "./index";

describe("Darstellung", () => {
  it("vergibt jeden Schlüssel nur einmal", () => {
    expect(new Set(DARSTELLUNG_KEYS).size).toBe(DARSTELLUNG_KEYS.length);
  });

  it("erkennt fremde Werte nicht als Voreinstellung", () => {
    expect(istDarstellung("standard")).toBe(true);
    expect(istDarstellung("riesig")).toBe(false);
    expect(istDarstellung(undefined)).toBe(false);
  });

  it("hält 'standard' als Rückfallwert vor", () => {
    expect(DARSTELLUNG_KEYS).toContain("standard");
  });

  it("beschreibt jede Voreinstellung in ganzen Sätzen", () => {
    for (const eintrag of DARSTELLUNG_DEFINITIONS) {
      expect(eintrag.name.length).toBeGreaterThan(2);
      expect(eintrag.description.length).toBeGreaterThan(20);
    }
  });
});
