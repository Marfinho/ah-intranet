import { describe, expect, it } from "vitest";
import { pruefeSitzungsschluessel } from "./auth.module";

const TAUGLICH = "S8mQ2xVn4pLr7KdTfYh1WgZc6BvNj0Ae";

describe("Sitzungsschlüssel", () => {
  it("weist den Beispielwert aus docker-compose ab", () => {
    expect(() => pruefeSitzungsschluessel("bitte-aendern-langer-zufallswert")).toThrow(/Beispielwert/);
  });

  it("weist den Wert der Prüfpipeline ab", () => {
    expect(() => pruefeSitzungsschluessel("ci-schluessel-ohne-bedeutung")).toThrow(/Beispielwert/);
  });

  it("achtet nicht auf Groß- und Kleinschreibung", () => {
    expect(() => pruefeSitzungsschluessel("  ChangeMe  ")).toThrow(/Beispielwert/);
  });

  it("verlangt in Produktion eine Mindestlänge", () => {
    expect(() => pruefeSitzungsschluessel("zu-kurz-aber-eigen", "production")).toThrow(/zu kurz/);
  });

  it("lässt kurze eigene Werte in der Entwicklung durch", () => {
    // Sonst bräuchte jede Entwicklungsumgebung eine Schlüsselverwaltung.
    expect(() => pruefeSitzungsschluessel("entwicklung", "development")).not.toThrow();
  });

  it("lässt einen tauglichen Schlüssel durch", () => {
    expect(() => pruefeSitzungsschluessel(TAUGLICH, "production")).not.toThrow();
  });
});
