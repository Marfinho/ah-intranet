import { describe, expect, it } from "vitest";
import { pruefeKennung } from "./kennung";

describe("pruefeKennung", () => {
  it.each(["autohaus-mueller", "haus1", "a1", "nord-24"])("lässt %s zu", (kennung) => {
    expect(pruefeKennung(kennung)).toBeNull();
  });

  it("behandelt Groß- und Kleinschreibung gleich", () => {
    expect(pruefeKennung("  Autohaus-Nord ")).toBeNull();
  });

  it.each(["Haus Zwei", "a.b", "häuser", "-haus", "a", "x".repeat(42)])("weist %s ab", (kennung) => {
    expect(pruefeKennung(kennung)).not.toBeNull();
  });

  it.each(["haus-", "ha--us", "xn--haus"])("weist die unzulässige Bindestrichform %s ab", (kennung) => {
    expect(pruefeKennung(kennung)).toMatch(/Bindestrich/);
  });

  it.each(["localhub", "www", "api", "admin", "verwaltung", "LOCALHUB"])(
    "weist die reservierte Kennung %s ab",
    (kennung) => {
      expect(pruefeKennung(kennung)).toMatch(/reserviert/);
    },
  );
});
