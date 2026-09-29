import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS, MODULE_DEFINITIONS } from "@ah-intranet/shared";
import { applyTenantScope, isGlobalModel } from "../src/core/tenant-isolation";

/**
 * Erste Einrichtung für den Betrieb: legt nur den Plattform-Mandanten samt
 * Konto an, ganz ohne Demodaten. Der Seed dagegen leert die Datenbank und
 * ist deshalb für einen Server mit echten Daten das falsche Werkzeug.
 *
 * Weigert sich, wenn es den Mandanten schon gibt - ein zweiter Lauf soll
 * nichts überschreiben und kein Passwort still zurücksetzen.
 */
const SLUG = "verwaltung";
const passwort = process.env.PLATTFORM_PASSWORT ?? "";

async function main() {
  if (passwort.length < 12) {
    throw new Error("PLATTFORM_PASSWORT fehlt oder ist kürzer als 12 Zeichen.");
  }

  const root = new PrismaClient();
  if (await root.tenant.findFirst({ where: { slug: SLUG } })) {
    console.log("Plattformverwaltung besteht bereits - nichts zu tun.");
    await root.$disconnect();
    return;
  }

  const tenant = await root.tenant.create({ data: { slug: SLUG, name: "AHOI Plattformverwaltung" } });
  await root.$disconnect();

  // Derselbe Mandantenfilter wie zur Laufzeit, damit die Daten dort auffindbar sind.
  const prisma = new PrismaClient();
  prisma.$use(async (params, next) => {
    if (!isGlobalModel(params.model)) {
      params.args = applyTenantScope(params, tenant.id);
    }
    return next(params);
  });

  await prisma.permission.createMany({
    data: PERMISSION_DEFINITIONS.map((p) => ({ key: p.key, name: p.name, description: p.description })),
  });
  const permissionByKey = new Map((await prisma.permission.findMany()).map((entry) => [entry.key, entry]));

  for (const role of ROLE_DEFINITIONS) {
    await prisma.role.create({
      data: {
        key: role.key,
        name: role.name,
        description: role.description,
        rank: role.rank,
        permissions: { create: role.permissions.map((key) => ({ permissionId: permissionByKey.get(key)!.id })) },
      },
    });
  }
  const adminRole = await prisma.role.findFirstOrThrow({ where: { key: "admin" } });

  const location = await prisma.location.create({ data: { name: "AHOI Plattform", code: "PF" } });
  const department = await prisma.department.create({ data: { name: "Plattformverwaltung", code: "PF" } });
  await prisma.locationDepartment.create({ data: { locationId: location.id, departmentId: department.id } });

  await prisma.user.create({
    data: {
      username: "plattform",
      email: "plattform@ahoi.example",
      passwordHash: await bcrypt.hash(passwort, 12),
      firstName: "Plattform",
      lastName: "Verwaltung",
      jobTitle: "Betreiber",
      locationId: location.id,
      departmentId: department.id,
      scopes: ["global", `location:${location.code}`, `department:${department.code}`],
      isPlatformAdmin: true,
      roles: { create: [{ roleId: adminRole.id }] },
    },
  });

  await prisma.moduleSetting.createMany({
    data: MODULE_DEFINITIONS.map((module) => ({ key: module.key, enabled: false })),
    skipDuplicates: true,
  });
  await prisma.$disconnect();

  console.log(`Plattformverwaltung eingerichtet: Adresse ${SLUG}.<BASE_DOMAIN>, Benutzer "plattform".`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
