import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { applyTenantScope, isGlobalModel, stampTenant } from "./tenant-isolation";

const TENANT = "haus-a";

function scope(model: string, action: Prisma.PrismaAction, args?: Record<string, unknown>) {
  return applyTenantScope({ model, action, args }, TENANT) as Record<string, any>;
}

describe("stampTenant", () => {
  it("schreibt den Fremdschlüssel skalar, solange der Datensatz es auch tut", () => {
    const result = stampTenant("Document", { title: "Preisliste", ownerId: "u1" }, TENANT) as Record<string, unknown>;

    expect(result).toEqual({ title: "Preisliste", ownerId: "u1", tenantId: TENANT });
  });

  it("schreibt ihn als Beziehung, sobald der Datensatz eine Beziehung verbindet", () => {
    const result = stampTenant("NewsPost", { title: "Hallo", author: { connect: { id: "u1" } } }, TENANT) as Record<
      string,
      unknown
    >;

    // Prisma erlaubt in dieser Schreibweise kein skalares `tenantId`.
    expect(result.tenantId).toBeUndefined();
    expect(result.tenant).toEqual({ connect: { id: TENANT } });
  });

  it("lässt sich von einer Sammelbeziehung nicht in die falsche Schreibweise drängen", () => {
    // `roles: { create }` zeigt auf die Gegenseite und ist in beiden
    // Schreibweisen erlaubt - der skalare Fremdschlüssel bleibt also gültig.
    const result = stampTenant(
      "User",
      { username: "admin", locationId: "l1", roles: { create: [{ roleId: "r1" }] } },
      TENANT,
    ) as Record<string, any>;

    expect(result.tenantId).toBe(TENANT);
    expect(result.roles.create[0].tenantId).toBe(TENANT);
  });

  it("steigt in verschachtelte Anlagen ab", () => {
    const result = stampTenant(
      "Role",
      { key: "admin", permissions: { create: [{ permissionId: "p1" }, { permissionId: "p2" }] } },
      TENANT,
    ) as Record<string, any>;

    expect(result.permissions.create.map((entry: { tenantId: string }) => entry.tenantId)).toEqual([TENANT, TENANT]);
  });

  it("überschreibt einen mitgegebenen fremden Mandanten", () => {
    const result = stampTenant("Document", { title: "x", tenantId: "haus-b" }, TENANT) as Record<string, unknown>;

    expect(result.tenantId).toBe(TENANT);
  });

  it("stempelt jeden Eintrag einer Liste", () => {
    const result = stampTenant("Permission", [{ key: "a" }, { key: "b" }], TENANT) as Array<{ tenantId: string }>;

    expect(result.map((entry) => entry.tenantId)).toEqual([TENANT, TENANT]);
  });
});

describe("applyTenantScope", () => {
  it("filtert Lesezugriffe, ohne bestehende Bedingungen zu verlieren", () => {
    const args = scope("Document", "findMany", { where: { isActive: true }, orderBy: { title: "asc" } });

    expect(args.where).toEqual({ isActive: true, tenantId: TENANT });
    expect(args.orderBy).toEqual({ title: "asc" });
  });

  it("filtert auch Löschen, Zählen und Aggregate", () => {
    for (const action of ["delete", "deleteMany", "count", "aggregate", "updateMany"] as Prisma.PrismaAction[]) {
      expect(scope("Document", action, { where: { id: "d1" } }).where).toMatchObject({ tenantId: TENANT });
    }
  });

  it("filtert auch ohne mitgegebene Argumente", () => {
    expect(scope("Document", "findMany").where).toEqual({ tenantId: TENANT });
  });

  it("stempelt Anlagen", () => {
    expect(scope("Document", "create", { data: { title: "x" } }).data).toMatchObject({ tenantId: TENANT });
  });

  it("behandelt upsert an beiden Enden: Bedingung filtern, Anlage stempeln", () => {
    const args = scope("ModuleSetting", "upsert", {
      where: { key: "news" },
      update: { enabled: false },
      create: { key: "news", enabled: false },
    });

    expect(args.where).toEqual({ key: "news", tenantId: TENANT });
    expect(args.create).toMatchObject({ tenantId: TENANT });
  });

  it("lässt die Mandantentabelle selbst unangetastet", () => {
    const args = scope("Tenant", "findMany", { where: { isActive: true } });

    expect(args.where).toEqual({ isActive: true });
    expect(isGlobalModel("Tenant")).toBe(true);
  });

  it("behandelt Aufrufe ohne Modell (Rohabfragen) als global", () => {
    expect(isGlobalModel(undefined)).toBe(true);
  });
});
