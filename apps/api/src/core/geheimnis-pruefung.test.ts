import { describe, expect, it } from "vitest";
import { pruefeGeheimnisse } from "./geheimnis-pruefung";

const gut = "9f3c1b7a5d2e84f06a1c3b5d7e9f1a2c4e6b8d0f2a4c6e8b0d2f4a6c8e0b2d4f";

describe("pruefeGeheimnisse", () => {
  it("prüft in der Entwicklung nichts", () => {
    expect(pruefeGeheimnisse({ JWT_SECRET: "bitte-aendern-langer-zufallswert" })).toEqual([]);
    expect(pruefeGeheimnisse({ NODE_ENV: "test" })).toEqual([]);
  });

  it("lässt gute Werte im Betrieb zu", () => {
    expect(pruefeGeheimnisse({ NODE_ENV: "production", JWT_SECRET: gut, SECRET_KEY: gut })).toEqual([]);
  });

  it("weist den Platzhalter aus der Beispieldatei ab", () => {
    expect(pruefeGeheimnisse({ NODE_ENV: "production", JWT_SECRET: "bitte-aendern-langer-zufallswert" })).toHaveLength(
      1,
    );
  });

  it("weist zu kurze Werte ab", () => {
    expect(pruefeGeheimnisse({ NODE_ENV: "production", JWT_SECRET: "a1b2c3d4" })).toHaveLength(1);
  });

  it("verlangt JWT_SECRET", () => {
    expect(pruefeGeheimnisse({ NODE_ENV: "production" })).toEqual(["JWT_SECRET fehlt."]);
  });

  it("lässt fehlendes SECRET_KEY zu, prüft es aber, wenn gesetzt", () => {
    expect(pruefeGeheimnisse({ NODE_ENV: "production", JWT_SECRET: gut })).toEqual([]);
    expect(pruefeGeheimnisse({ NODE_ENV: "production", JWT_SECRET: gut, SECRET_KEY: "kurz" })).toHaveLength(1);
  });
});
