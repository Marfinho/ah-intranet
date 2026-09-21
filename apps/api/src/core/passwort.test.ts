import { describe, expect, it } from "vitest";
import { PASSWORT_ALPHABET, PASSWORT_LAENGE, erzeugeStartpasswort } from "./passwort";

describe("Startpasswort", () => {
  it("hat die festgelegte Länge samt Sonderzeichen", () => {
    expect(erzeugeStartpasswort()).toHaveLength(PASSWORT_LAENGE + 1);
  });

  it("erfüllt die Mindestlänge, die der Passwortwechsel verlangt", () => {
    expect(erzeugeStartpasswort().length).toBeGreaterThanOrEqual(10);
  });

  it("benutzt nur Zeichen des Alphabets", () => {
    const passwort = erzeugeStartpasswort();
    expect([...passwort.slice(0, -1)].every((zeichen) => PASSWORT_ALPHABET.includes(zeichen))).toBe(true);
    expect(passwort.endsWith("!")).toBe(true);
  });

  it("lässt verwechselbare Zeichen weg", () => {
    // 0/O und 1/l/I am Telefon auseinanderzuhalten ist aussichtslos.
    expect(/[0O1lI]/.test(erzeugeStartpasswort().slice(0, -1))).toBe(false);
  });

  it("wiederholt sich nicht", () => {
    const menge = new Set(Array.from({ length: 200 }, () => erzeugeStartpasswort()));
    expect(menge.size).toBe(200);
  });
});
