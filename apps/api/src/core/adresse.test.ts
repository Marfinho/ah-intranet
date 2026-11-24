import { describe, expect, it } from "vitest";
import { hausAdresse } from "./adresse";

describe("hausAdresse", () => {
  const haus = { slug: "autohaus-nord", domain: null };

  it("bildet die Adresse aus Kennung und Basisdomain", () => {
    expect(hausAdresse(haus, { BASE_DOMAIN: "ahoi.example", FRONTEND_URL: "https://a.ahoi.example" })).toBe(
      "https://autohaus-nord.ahoi.example",
    );
  });

  it("übernimmt http, wenn die Konfiguration http verwendet", () => {
    expect(hausAdresse(haus, { BASE_DOMAIN: "1-2-3-4.sslip.io", FRONTEND_URL: "http://a.1-2-3-4.sslip.io" })).toBe(
      "http://autohaus-nord.1-2-3-4.sslip.io",
    );
  });

  it("bevorzugt eine eigene Domain des Hauses", () => {
    expect(hausAdresse({ slug: "nord", domain: "intranet.autohaus-nord.de" }, { BASE_DOMAIN: "ahoi.example" })).toBe(
      "https://intranet.autohaus-nord.de",
    );
  });

  it("setzt keine Liste zusammen, wenn es keine Basisdomain gibt", () => {
    expect(hausAdresse(haus, { FRONTEND_URL: "http://localhost:3000, http://zwei.localhost:3000" })).toBe(
      "http://localhost:3000",
    );
  });

  it("entfernt den Schrägstrich am Ende und liefert leer, wenn nichts bekannt ist", () => {
    expect(hausAdresse(haus, { FRONTEND_URL: "https://intranet.example/" })).toBe("https://intranet.example");
    expect(hausAdresse(haus, {})).toBe("");
  });
});
