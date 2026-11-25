import { describe, expect, it } from "vitest";
import { leseModellMeta } from "./modell-meta-lesen";
import { Prisma } from "../generated/prisma/client";
import { MODELL_META } from "../generated/modell-meta";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("leseModellMeta", () => {
  const schema = `
model Tenant {
  id    String @id
  posts Post[]
}

model User {
  id       String @id
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id])
  posts    Post[] @relation("Autor")
  // kommentar  Tenant @relation(fields: [x], references: [id])
  @@index([tenantId])
}

model Post {
  id       String  @id
  authorId String
  author   User    @relation("Autor", fields: [authorId], references: [id])
  tenant   Tenant? @relation(fields: [tenantId], references: [id])
  tenantId String?
  titel    String
}
`;

  it("erkennt Beziehungen und auf welcher Seite der Fremdschlüssel liegt", () => {
    const meta = leseModellMeta(schema);
    expect(meta.User!.tenant).toEqual({ target: "Tenant", owned: true });
    expect(meta.User!.posts).toEqual({ target: "Post", owned: false });
    expect(meta.Post!.author).toEqual({ target: "User", owned: true });
    expect(meta.Post!.tenant).toEqual({ target: "Tenant", owned: true });
    expect(meta.Tenant!.posts).toEqual({ target: "Post", owned: false });
  });

  it("zählt skalare Felder, Kommentare und Attribute auf Modellebene nicht mit", () => {
    const meta = leseModellMeta(schema);
    expect(Object.keys(meta.User!).sort()).toEqual(["posts", "tenant"]);
    expect(meta.Post!.titel).toBeUndefined();
  });
});

describe("MODELL_META gegen das erzeugte Datenmodell", () => {
  const modelle = Object.keys(Prisma.ModelName);

  it("kennt genau die Modelle des Clients", () => {
    expect(Object.keys(MODELL_META).sort()).toEqual([...modelle].sort());
  });

  it("verweist nur auf Modelle, die es gibt", () => {
    for (const [modell, beziehungen] of Object.entries(MODELL_META)) {
      for (const [feld, beziehung] of Object.entries(beziehungen)) {
        expect(modelle, `${modell}.${feld}`).toContain(beziehung.target);
      }
    }
  });

  it("ist aktuell: wurde das Schema geändert, ohne `prisma:generate` zu laufen, fällt es hier auf", () => {
    const schema = readFileSync(join(__dirname, "../../prisma/schema.prisma"), "utf8");
    expect(MODELL_META).toEqual(leseModellMeta(schema));
  });

  // Die Mandantentrennung stützt sich darauf, dass jedes Modell außer der
  // Mandantentabelle selbst einen Mandanten trägt. Ein neues Modell ohne ihn
  // würde vom Filter stillschweigend nichts abbekommen.
  it("jedes Modell außer Tenant trägt tenantId und eine besitzende Beziehung `tenant`", () => {
    const ohne: string[] = [];
    for (const modell of modelle.filter((name) => name !== "Tenant")) {
      const felder = (Prisma as unknown as Record<string, Record<string, string>>)[`${modell}ScalarFieldEnum`] ?? {};
      const beziehung = MODELL_META[modell]?.tenant;
      if (!("tenantId" in felder) || beziehung?.target !== "Tenant" || !beziehung.owned) {
        ohne.push(modell);
      }
    }
    expect(ohne, `ohne Mandantenbezug: ${ohne.join(", ")}`).toEqual([]);
  });
});
