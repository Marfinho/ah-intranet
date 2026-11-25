import { describe, expect, it } from "vitest";
import {
  base32Dekodieren,
  base32Kodieren,
  hashWiederherstellungscode,
  neueWiederherstellungscodes,
  neuesTotpGeheimnis,
  pruefeTotp,
  totpAdresse,
  totpCode,
  zeitschritt,
} from "./totp";

/** Geheimnis der RFC-6238-Testvektoren: ASCII "12345678901234567890". */
const RFC_GEHEIMNIS = base32Kodieren(Buffer.from("12345678901234567890"));

describe("TOTP nach RFC 6238", () => {
  // Anhang B der RFC, achtstellig; die letzten sechs Stellen sind der Sechsstellige.
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ])("liefert für %i s den Testvektor %s", (sekunden, achtstellig) => {
    expect(totpCode(RFC_GEHEIMNIS, zeitschritt(sekunden * 1000), 8)).toBe(achtstellig);
    expect(totpCode(RFC_GEHEIMNIS, zeitschritt(sekunden * 1000))).toBe(achtstellig.slice(2));
  });

  it("kodiert Base32 hin und zurück", () => {
    const daten = Buffer.from("Hallo Welt, das ist ein Test");
    expect(base32Dekodieren(base32Kodieren(daten)).equals(daten)).toBe(true);
    expect(base32Kodieren(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
  });

  it("akzeptiert den Code der laufenden Periode", () => {
    const jetzt = 1_700_000_000_000;
    const code = totpCode(RFC_GEHEIMNIS, zeitschritt(jetzt));
    expect(pruefeTotp(RFC_GEHEIMNIS, code, null, jetzt)).toBe(zeitschritt(jetzt));
  });

  it("toleriert eine Periode Uhrabweichung, aber nicht mehr", () => {
    const jetzt = 1_700_000_000_000;
    const schritt = zeitschritt(jetzt);
    expect(pruefeTotp(RFC_GEHEIMNIS, totpCode(RFC_GEHEIMNIS, schritt - 1), null, jetzt)).toBe(schritt - 1);
    expect(pruefeTotp(RFC_GEHEIMNIS, totpCode(RFC_GEHEIMNIS, schritt + 1), null, jetzt)).toBe(schritt + 1);
    expect(pruefeTotp(RFC_GEHEIMNIS, totpCode(RFC_GEHEIMNIS, schritt - 2), null, jetzt)).toBeNull();
    expect(pruefeTotp(RFC_GEHEIMNIS, totpCode(RFC_GEHEIMNIS, schritt + 2), null, jetzt)).toBeNull();
  });

  it("lässt einen Code nur einmal gelten", () => {
    const jetzt = 1_700_000_000_000;
    const code = totpCode(RFC_GEHEIMNIS, zeitschritt(jetzt));
    const schritt = pruefeTotp(RFC_GEHEIMNIS, code, null, jetzt);
    expect(schritt).not.toBeNull();
    expect(pruefeTotp(RFC_GEHEIMNIS, code, schritt, jetzt)).toBeNull();
  });

  it("weist falsche und fehlgeformte Eingaben ab", () => {
    const jetzt = 1_700_000_000_000;
    expect(pruefeTotp(RFC_GEHEIMNIS, "000000", null, jetzt)).toBeNull();
    expect(pruefeTotp(RFC_GEHEIMNIS, "12345", null, jetzt)).toBeNull();
    expect(pruefeTotp(RFC_GEHEIMNIS, "abcdef", null, jetzt)).toBeNull();
    expect(pruefeTotp(RFC_GEHEIMNIS, "", null, jetzt)).toBeNull();
  });

  it("ignoriert Leerzeichen, wie sie Apps beim Anzeigen einfügen", () => {
    const jetzt = 1_700_000_000_000;
    const code = totpCode(RFC_GEHEIMNIS, zeitschritt(jetzt));
    expect(pruefeTotp(RFC_GEHEIMNIS, `${code.slice(0, 3)} ${code.slice(3)}`, null, jetzt)).not.toBeNull();
  });

  it("erzeugt ein neues Geheimnis mit 160 Bit je Aufruf", () => {
    const a = neuesTotpGeheimnis();
    expect(base32Dekodieren(a)).toHaveLength(20);
    expect(neuesTotpGeheimnis()).not.toBe(a);
  });

  it("baut eine otpauth-Adresse für Authenticator-Apps", () => {
    const adresse = totpAdresse("ABC234", "p.hansen", "AHOI Haus Müller");
    expect(adresse).toMatch(/^otpauth:\/\/totp\//);
    expect(adresse).toContain("secret=ABC234");
    expect(adresse).toContain("digits=6");
    expect(adresse).toContain("period=30");
    expect(adresse).toContain(encodeURIComponent("AHOI Haus Müller:p.hansen"));
  });
});

describe("Wiederherstellungscodes", () => {
  it("liefert zehn verschiedene Codes im Format xxxx-xxxx", () => {
    const codes = neueWiederherstellungscodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    }
  });

  it("hasht unabhängig von Bindestrich, Leerzeichen und Schreibweise", () => {
    expect(hashWiederherstellungscode("abcd-efgh")).toBe(hashWiederherstellungscode(" ABCD EFGH "));
    expect(hashWiederherstellungscode("abcd-efgh")).not.toBe(hashWiederherstellungscode("abcd-efgi"));
  });
});
