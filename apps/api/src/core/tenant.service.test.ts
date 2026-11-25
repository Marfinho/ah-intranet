import { describe, expect, it } from "vitest";
import { slugFromHost, slugUnterBasis } from "./tenant.service";

describe("slugFromHost", () => {
  it("liest die Kennung aus einer echten Subdomain", () => {
    expect(slugFromHost("autohaus-mueller.ahoi.de")).toBe("autohaus-mueller");
  });

  it("liest die Kennung aus `<slug>.localhost` für die lokale Erprobung", () => {
    expect(slugFromHost("autohaus-mueller.localhost")).toBe("autohaus-mueller");
  });

  it("berücksichtigt einen mitgegebenen Port", () => {
    expect(slugFromHost("autohaus-mueller.localhost:3000")).toBe("autohaus-mueller");
  });

  it("liefert nichts für die bloße Basis-Domain", () => {
    expect(slugFromHost("ahoi.de")).toBeNull();
  });

  it("liefert nichts für `localhost` allein", () => {
    expect(slugFromHost("localhost")).toBeNull();
    expect(slugFromHost("localhost:3000")).toBeNull();
  });

  it("liefert nichts für eine IP-Adresse", () => {
    expect(slugFromHost("192.168.1.10")).toBeNull();
  });

  it("liefert nichts ohne Host", () => {
    expect(slugFromHost(undefined)).toBeNull();
  });
});

describe("slugUnterBasis", () => {
  it("liest die Kennung einer direkten Unterdomain der Basisadresse", () => {
    expect(slugUnterBasis("haus1.ahoi.de", "ahoi.de")).toBe("haus1");
    expect(slugUnterBasis("Haus1.AHOI.de:443", "ahoi.de")).toBe("haus1");
  });

  it("weist eine fremde Domain ab, auch wenn ihr erstes Label eine Kennung wäre", () => {
    expect(slugUnterBasis("haus1.attacker.example", "ahoi.de")).toBeNull();
    expect(slugUnterBasis("haus1.ahoi.de.attacker.example", "ahoi.de")).toBeNull();
    expect(slugUnterBasis("haus1ahoi.de", "ahoi.de")).toBeNull();
  });

  it("weist tiefere Unterdomains ab", () => {
    expect(slugUnterBasis("a.haus1.ahoi.de", "ahoi.de")).toBeNull();
  });

  it("weist die Basisadresse selbst und leere Eingaben ab", () => {
    expect(slugUnterBasis("ahoi.de", "ahoi.de")).toBeNull();
    expect(slugUnterBasis("", "ahoi.de")).toBeNull();
  });

  it("liefert ohne Basisadresse nie eine Kennung", () => {
    expect(slugUnterBasis("haus1.ahoi.de", undefined)).toBeNull();
    expect(slugUnterBasis("haus1.ahoi.de", "")).toBeNull();
  });
});
