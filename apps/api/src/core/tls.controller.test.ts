import { NotFoundException } from "@nestjs/common";
import { afterEach, describe, expect, it } from "vitest";
import type { TenantService } from "./tenant.service";
import { TlsController } from "./tls.controller";

function controller(bekannt: string[]) {
  const tenants = { kenntHost: async (host: string) => bekannt.includes(host) } as unknown as TenantService;
  return new TlsController(tenants);
}

describe("TlsController", () => {
  const basis = process.env.BASE_DOMAIN;
  afterEach(() => {
    process.env.BASE_DOMAIN = basis;
  });

  it("erlaubt ein Zertifikat für ein bekanntes Haus", async () => {
    await expect(controller(["haus1.ahoi.de"]).erlaubt("haus1.ahoi.de")).resolves.toEqual({ ok: true });
  });

  it("erlaubt die Basisadresse für die Landingpage", async () => {
    process.env.BASE_DOMAIN = "ahoi.de";
    await expect(controller([]).erlaubt("ahoi.de")).resolves.toEqual({ ok: true });
  });

  it("weist einen unbekannten Namen ab, statt Zertifikate auf Zuruf auszustellen", async () => {
    process.env.BASE_DOMAIN = "ahoi.de";
    await expect(controller(["haus1.ahoi.de"]).erlaubt("angreifer.example.com")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("weist eine Anfrage ohne Namen ab", async () => {
    await expect(controller(["haus1.ahoi.de"]).erlaubt(undefined)).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller(["haus1.ahoi.de"]).erlaubt("")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("gleicht Groß- und Kleinschreibung ab", async () => {
    await expect(controller(["haus1.ahoi.de"]).erlaubt("Haus1.AHOI.de")).resolves.toEqual({ ok: true });
  });
});
