import { describe, expect, it } from "vitest";
import { sichereCookiesAktiv, sitzungsCookieName } from "./sitzung";

describe("Sitzungscookie", () => {
  it("trägt den Präfix nur im scharfen Modus", () => {
    expect(sitzungsCookieName(true)).toBe("__Host-ah_session");
    expect(sitzungsCookieName(false)).toBe("ah_session");
  });

  it("folgt dem ausdrücklichen Schalter, nicht NODE_ENV", () => {
    // Der Fall, der die Anmeldung zerlegte: `next start` setzt von sich aus
    // NODE_ENV=production, die API blieb auf development. Der Schalter muss
    // beide auf dieselbe Antwort bringen.
    expect(sichereCookiesAktiv({ AHOI_SECURE_COOKIES: "true", NODE_ENV: "development" })).toBe(true);
    expect(sichereCookiesAktiv({ AHOI_SECURE_COOKIES: "false", NODE_ENV: "production" })).toBe(false);
  });

  it("achtet nicht auf Groß- und Kleinschreibung oder Leerzeichen", () => {
    expect(sichereCookiesAktiv({ AHOI_SECURE_COOKIES: " TRUE " })).toBe(true);
  });

  it("fällt ohne Schalter auf NODE_ENV zurück", () => {
    expect(sichereCookiesAktiv({ NODE_ENV: "production" })).toBe(true);
    expect(sichereCookiesAktiv({ NODE_ENV: "development" })).toBe(false);
    expect(sichereCookiesAktiv({})).toBe(false);
  });

  it("behandelt einen leeren Schalter wie keinen", () => {
    // Compose reicht nicht gesetzte Variablen als leeren Text durch.
    expect(sichereCookiesAktiv({ AHOI_SECURE_COOKIES: "", NODE_ENV: "production" })).toBe(true);
  });
});
