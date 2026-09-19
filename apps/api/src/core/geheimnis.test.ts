import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GeheimnisFehltError, entschluessele, istVerschluesselungMoeglich, verschluessele } from "./geheimnis";

describe("Geheimnisse", () => {
  const vorher = process.env.SECRET_KEY;

  beforeEach(() => {
    process.env.SECRET_KEY = "prüfschlüssel-für-den-test";
  });

  afterEach(() => {
    if (vorher === undefined) {
      delete process.env.SECRET_KEY;
    } else {
      process.env.SECRET_KEY = vorher;
    }
  });

  it("gibt den Klartext zurück, nicht mehr und nicht weniger", () => {
    expect(entschluessele(verschluessele("s3hr-geheim!"))).toBe("s3hr-geheim!");
  });

  it("erzeugt für denselben Wert zweimal verschiedene Chiffrate", () => {
    // Gleiches Chiffrat verriete, dass zwei Häuser dasselbe Geheimnis nutzen.
    expect(verschluessele("gleich")).not.toBe(verschluessele("gleich"));
  });

  it("merkt, wenn am gespeicherten Wert gedreht wurde", () => {
    const gespeichert = verschluessele("unversehrt");
    const [nonce, etikett, chiffrat] = gespeichert.split(":");
    const verdreht = `${nonce}:${etikett}:${chiffrat.slice(0, -2)}${chiffrat.slice(-2) === "00" ? "01" : "00"}`;
    expect(() => entschluessele(verdreht)).toThrow();
  });

  it("weist ein Geheimnis ohne Format ab", () => {
    expect(() => entschluessele("nur-irgendwas")).toThrow("kein gültiges Format");
  });

  it("verweigert die Arbeit ohne Schlüssel, statt im Klartext zu speichern", () => {
    delete process.env.SECRET_KEY;
    expect(istVerschluesselungMoeglich()).toBe(false);
    expect(() => verschluessele("geheim")).toThrow(GeheimnisFehltError);
  });
});
