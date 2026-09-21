import { describe, expect, it, vi } from "vitest";
import { AuditService } from "./audit.service";
import type { PrismaService } from "./prisma.service";

function dienst(schreiben: () => Promise<unknown>) {
  const prisma = { auditLog: { create: vi.fn(schreiben) } } as unknown as PrismaService;
  return { dienst: new AuditService(prisma), prisma };
}

const eintrag = {
  actor: { id: "u1", username: "mmeier" },
  action: "order.approve",
  entityType: "order",
  entityId: "o1",
  detail: "Freigabe erteilt",
};

describe("Audit-Protokoll", () => {
  it("zählt keine Ausfälle, solange geschrieben wird", async () => {
    const { dienst: audit } = dienst(async () => ({ id: "a1" }));
    await audit.log(eintrag);
    expect(audit.ausfaelleImFenster()).toBe(0);
  });

  it("lässt die Fachaktion nicht am Protokoll scheitern", async () => {
    const { dienst: audit } = dienst(async () => {
      throw new Error("Datenbank weg");
    });
    await expect(audit.log(eintrag)).resolves.toBeUndefined();
  });

  it("macht den Ausfall zählbar, statt ihn zu verschlucken", async () => {
    const { dienst: audit } = dienst(async () => {
      throw new Error("Datenbank weg");
    });
    await audit.log(eintrag);
    await audit.log(eintrag);
    expect(audit.ausfaelleImFenster()).toBe(2);
  });

  it("vergisst Ausfälle, die älter als eine Stunde sind", async () => {
    const { dienst: audit } = dienst(async () => {
      throw new Error("Datenbank weg");
    });
    await audit.log(eintrag);

    const inZweiStunden = Date.now() + 2 * 60 * 60 * 1000;
    expect(audit.ausfaelleImFenster(inZweiStunden)).toBe(0);
  });
});
