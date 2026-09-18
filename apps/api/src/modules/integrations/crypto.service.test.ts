import { describe, expect, it } from "vitest";
import { ConfigService } from "@nestjs/config";
import { IntegrationCryptoService } from "./crypto.service";

/**
 * Hier liegen Zugangsdaten zu Fremdsystemen. Geprüft wird nicht nur, dass die
 * Rückrichtung stimmt, sondern auch, dass Manipulation auffliegt und ein
 * fehlender Schlüssel den Betrieb hart stoppt statt still Klartext abzulegen.
 */

function serviceWith(key: string | undefined): IntegrationCryptoService {
  const config = { get: (name: string) => (name === "INTEGRATION_SECRET_KEY" ? key : undefined) };
  return new IntegrationCryptoService(config as unknown as ConfigService);
}

const service = serviceWith("ein-hinreichend-langer-testschluessel");

describe("IntegrationCryptoService", () => {
  it("entschlüsselt, was es verschlüsselt hat", () => {
    expect(service.decrypt(service.encrypt("geheim123"))).toBe("geheim123");
  });

  it("kommt mit Umlauten und Sonderzeichen zurecht", () => {
    const wert = "Paßwort-mit-Ümläuten & Sonderzeichen €";
    expect(service.decrypt(service.encrypt(wert))).toBe(wert);
  });

  it("erzeugt für denselben Klartext unterschiedliche Chiffrate", () => {
    // Jeder Aufruf bekommt eine eigene IV; gleiche Werte dürfen sich nicht
    // gegenseitig verraten.
    expect(service.encrypt("gleich")).not.toBe(service.encrypt("gleich"));
  });

  it("legt Version, IV, Tag und Chiffrat getrennt ab", () => {
    const parts = service.encrypt("wert").split(":");

    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
    expect(parts.slice(1).every((part) => part.length > 0)).toBe(true);
  });

  it("weist ein verändertes Chiffrat ab, statt Unsinn zurückzugeben", () => {
    const [version, iv, tag] = service.encrypt("wert").split(":");
    const manipuliert = [version, iv, tag, Buffer.from("angriff").toString("base64")].join(":");

    expect(() => service.decrypt(manipuliert)).toThrow();
  });

  it("weist ein verändertes Authentifizierungs-Tag ab", () => {
    const [version, iv, , data] = service.encrypt("wert").split(":");
    const manipuliert = [version, iv, Buffer.alloc(16).toString("base64"), data].join(":");

    expect(() => service.decrypt(manipuliert)).toThrow();
  });

  it("weist ein unbekanntes Format ab", () => {
    expect(() => service.decrypt("klartext")).toThrow(/unbekanntes Format/i);
  });

  it("kann mit einem anderen Schlüssel nicht entschlüsselt werden", () => {
    const fremd = serviceWith("ein-voellig-anderer-testschluessel");

    expect(() => fremd.decrypt(service.encrypt("wert"))).toThrow();
  });

  it("verweigert den Dienst ohne gesetzten Schlüssel", () => {
    const ohne = serviceWith(undefined);

    expect(ohne.isConfigured()).toBe(false);
    expect(() => ohne.encrypt("wert")).toThrow(/INTEGRATION_SECRET_KEY/);
  });

  it("verweigert den Dienst bei zu kurzem Schlüssel", () => {
    expect(serviceWith("kurz").isConfigured()).toBe(false);
  });
});
