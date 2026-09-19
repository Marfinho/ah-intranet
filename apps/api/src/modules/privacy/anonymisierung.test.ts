import { describe, expect, it } from "vitest";
import { anonymeKennung, anonymisierteFelder } from "./anonymisierung";

describe("Anonymisierung", () => {
  it("bildet eine Kennung ohne Bezug zur früheren", () => {
    const kennung = anonymeKennung("cmu784w65001nh09itaf3pyop");

    expect(kennung).toBe("geloescht-taf3pyop");
  });

  it("vergibt für verschiedene Konten verschiedene Kennungen", () => {
    expect(anonymeKennung("aaaaaaaa1111")).not.toBe(anonymeKennung("aaaaaaaa2222"));
  });

  it("entfernt jedes identifizierende Feld", () => {
    const felder = anonymisierteFelder("cmu784w65001nh09itaf3pyop");

    expect(felder.email).toBeNull();
    expect(felder.phone).toBeNull();
    expect(felder.mobile).toBeNull();
    expect(felder.responsibilities).toEqual([]);
    expect(felder.scopes).toEqual([]);
    expect(felder.locationId).toBeNull();
    expect(felder.departmentId).toBeNull();
  });

  it("macht das Konto unbenutzbar und beendet laufende Sitzungen", () => {
    const felder = anonymisierteFelder("u1");

    expect(felder.status).toBe("deleted");
    // Kein gültiger bcrypt-Hash - ein Vergleich kann nie zutreffen.
    expect(felder.passwordHash.startsWith("$2")).toBe(false);
    expect(felder.tokenVersion).toEqual({ increment: 1 });
  });

  it("hält den Zeitpunkt fest", () => {
    const jetzt = new Date("2026-03-01T10:00:00Z");

    expect(anonymisierteFelder("u1", jetzt).anonymizedAt).toEqual(jetzt);
  });
});
