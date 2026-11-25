/**
 * Prüft die Mandantentrennung gegen eine echte Datenbank mit Seed-Daten.
 *
 * Die Unit-Tests prüfen die Filterlogik (`core/tenant-isolation.ts`), nicht ihr
 * Zusammenspiel mit dem Client. Diese Prüfung fängt, was dazwischen bricht -
 * etwa ein Prisma-Sprung, der die Erweiterung nicht mehr an jede Abfrage hängt
 * (so war es bei der Middleware, die Prisma 7 entfernt hat). Sie läuft in der CI
 * nach dem Seed und beendet sich mit Fehlercode, wenn ein Punkt fehlschlägt.
 *
 *   pnpm --filter api exec tsx prisma/pruefung-trennung.ts
 */
import { PrismaService } from "../src/core/prisma.service";
import { runUnscoped, runWithTenant } from "../src/core/tenant-context";

let fehlgeschlagen = 0;

async function main() {
  const prisma = new PrismaService();
  const ok = (b: boolean, t: string) => {
    // eslint-disable-next-line no-console -- ein Prüfskript, das Ergebnisse ausgibt
    console.log((b ? "OK    " : "FEHLER") + " " + t);
    if (!b) fehlgeschlagen++;
  };

  // 1. Ohne Kontext: harter Fehler
  let fehler = "";
  try {
    await prisma.user.findMany();
  } catch (e) {
    fehler = (e as Error).message;
  }
  ok(/ohne Mandantenkontext/.test(fehler), "ohne Mandantenkontext wird abgewiesen");

  const haeuser = await runUnscoped(async () => await prisma.tenant.findMany({ select: { id: true, slug: true } }));
  const [a, b] = haeuser.filter((h) => h.slug.startsWith("autohaus"));
  const alle = await runUnscoped(async () => await prisma.user.count());

  // 2. Mit Kontext: nur das eigene Haus
  const ua = await runWithTenant({ tenantId: a!.id, slug: a!.slug }, async () => await prisma.user.findMany());
  const ub = await runWithTenant({ tenantId: b!.id, slug: b!.slug }, async () => await prisma.user.findMany());
  ok(ua.length > 0 && ua.every((u) => u.tenantId === a!.id), `Haus A sieht ${ua.length} Konten, alle eigene`);
  ok(ub.length > 0 && ub.every((u) => u.tenantId === b!.id), `Haus B sieht ${ub.length} Konten, alle eigene`);
  ok(ua.length + ub.length < alle, `ohne Filter wären es ${alle}`);

  // 3. Fremde Datensätze per ID nicht erreichbar (lesen, ändern, löschen)
  const fremd = ub[0]!;
  const lesen = await runWithTenant(
    { tenantId: a!.id, slug: a!.slug },
    async () => await prisma.user.findUnique({ where: { id: fremd.id } }),
  );
  ok(lesen === null, "fremdes Konto per findUnique nicht lesbar");
  const aender = await runWithTenant(
    { tenantId: a!.id, slug: a!.slug },
    async () => await prisma.user.updateMany({ where: { id: fremd.id }, data: { jobTitle: "gehackt" } }),
  );
  ok(aender.count === 0, "fremdes Konto per updateMany nicht änderbar");
  const loesch = await runWithTenant(
    { tenantId: a!.id, slug: a!.slug },
    async () => await prisma.user.deleteMany({ where: { id: fremd.id } }),
  );
  ok(loesch.count === 0, "fremdes Konto per deleteMany nicht löschbar");

  // 4. Anlage landet im richtigen Haus - auch verschachtelt und mit Beziehung
  const rolle = await runWithTenant(
    { tenantId: a!.id, slug: a!.slug },
    async () =>
      await prisma.role.create({
        data: { key: "t-" + Date.now(), name: "Trenntest", description: "t", rank: 1, permissions: { create: [] } },
      }),
  );
  ok(rolle.tenantId === a!.id, "neue Rolle trägt den Mandanten des Kontexts");
  const post = await runWithTenant(
    { tenantId: a!.id, slug: a!.slug },
    async () =>
      await prisma.newsPost.create({
        data: {
          slug: "t-" + Date.now(),
          title: "x",
          teaser: "y",
          content: "z",
          author: { connect: { id: ua[0]!.id } },
        } as never,
      }),
  );
  ok(post.tenantId === a!.id, "Beitrag mit author-connect trägt den Mandanten (geprüfte Schreibweise)");
  // ein mitgegebener falscher Mandant wird überschrieben
  const gefaelscht = await runWithTenant(
    { tenantId: a!.id, slug: a!.slug },
    async () =>
      await prisma.role.create({
        data: { key: "f-" + Date.now(), name: "Fälschung", description: "t", rank: 1, tenantId: b!.id } as never,
      }),
  );
  ok(gefaelscht.tenantId === a!.id, "ein mitgegebener fremder Mandant wird überschrieben");

  // 5. Transaktionen (Array und interaktiv)
  const [n1, n2] = await runWithTenant(
    { tenantId: b!.id, slug: b!.slug },
    async () => await prisma.$transaction([prisma.user.count(), prisma.role.count()]),
  );
  ok(n1 === ub.length, `Array-Transaktion gefiltert (${n1} Konten, ${n2} Rollen)`);
  const tx = await runWithTenant(
    { tenantId: b!.id, slug: b!.slug },
    async () => await prisma.$transaction(async (t) => await t.user.count()),
  );
  ok(tx === ub.length, `interaktive Transaktion gefiltert (${tx})`);

  // 6. Aufräumen
  await runUnscoped(async () => {
    await prisma.newsPost.deleteMany({ where: { id: post.id } });
    await prisma.role.deleteMany({ where: { id: { in: [rolle.id, gefaelscht.id] } } });
  });
  await prisma.$disconnect();
}
main()
  .then(() => process.exit(fehlgeschlagen > 0 ? 1 : 0))
  .catch((e) => {
    console.error("ABBRUCH", e);
    process.exit(1);
  });
