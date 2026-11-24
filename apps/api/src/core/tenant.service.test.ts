import { describe, expect, it } from "vitest";
import { slugFromHost } from "./tenant.service";

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
