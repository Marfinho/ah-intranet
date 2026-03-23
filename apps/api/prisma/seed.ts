import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Start123!", 10);

  const permissions = [
    ["news.read", "News lesen"],
    ["news.manage", "News verwalten"],
    ["orders.create", "Bestellungen anlegen"],
    ["orders.review", "Bestellungen prüfen"],
    ["admin.access", "Adminbereich öffnen"],
    ["audit.read", "Audit-Log lesen"],
  ];

  for (const [key, name] of permissions) {
    await prisma.permission.upsert({
      where: { key },
      update: { name, description: name },
      create: { key, name, description: name },
    });
  }

  const roles = [
    { key: "mitarbeiter", name: "Mitarbeiter", description: "Standardrolle" },
    { key: "admin", name: "Admin", description: "Globaler Administrator" },
    { key: "fachbereichsadmin", name: "Fachbereichsadmin", description: "Scoped Adminrolle" },
  ];

  for (const role of roles) {
    await prisma.role.upsert({ where: { key: role.key }, update: role, create: role });
  }

  const berlin = await prisma.location.upsert({
    where: { code: "BER-MITTE" },
    update: { name: "Berlin Mitte" },
    create: { code: "BER-MITTE", name: "Berlin Mitte" },
  });

  const service = await prisma.department.upsert({
    where: { code: "SERVICE" },
    update: { name: "Service" },
    create: { code: "SERVICE", name: "Service" },
  });

  const specialty = await prisma.specialtyArea.upsert({
    where: { code: "KUNDENDIENST" },
    update: { name: "Kundendienst" },
    create: { code: "KUNDENDIENST", name: "Kundendienst" },
  });

  const users = [
    {
      username: "admin",
      email: "admin@autohaus.local",
      firstName: "Markus",
      lastName: "Becker",
      roleKey: "admin",
    },
    {
      username: "service.mitte",
      email: "anna.richter@autohaus.local",
      firstName: "Anna",
      lastName: "Richter",
      roleKey: "mitarbeiter",
    },
    {
      username: "fachbereich",
      email: "timo.neumann@autohaus.local",
      firstName: "Timo",
      lastName: "Neumann",
      roleKey: "fachbereichsadmin",
    },
  ];

  for (const user of users) {
    const dbUser = await prisma.user.upsert({
      where: { username: user.username },
      update: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        passwordHash,
        locationId: berlin.id,
        departmentId: service.id,
        specialtyAreaId: specialty.id,
      },
      create: {
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        passwordHash,
        locationId: berlin.id,
        departmentId: service.id,
        specialtyAreaId: specialty.id,
      },
    });

    const role = await prisma.role.findUniqueOrThrow({ where: { key: user.roleKey } });
    await prisma.userRole.upsert({
      where: {
        userId_roleId_scopeType_scopeLocationId_scopeDepartmentId_scopeSpecialtyAreaId: {
          userId: dbUser.id,
          roleId: role.id,
          scopeType: "global",
          scopeLocationId: null,
          scopeDepartmentId: null,
          scopeSpecialtyAreaId: null,
        },
      },
      update: {},
      create: { userId: dbUser.id, roleId: role.id, scopeType: "global" },
    });
  }

  await prisma.orderCycle.upsert({
    where: { id: "business-cards-cycle" },
    update: {
      cycleType: "business_cards",
      title: "Visitenkarten März 2026",
      nextOrderDate: new Date("2026-03-27T12:00:00.000Z"),
      notes: "Freitags-Sammelbestellung",
      locationId: berlin.id,
    },
    create: {
      id: "business-cards-cycle",
      cycleType: "business_cards",
      title: "Visitenkarten März 2026",
      nextOrderDate: new Date("2026-03-27T12:00:00.000Z"),
      notes: "Freitags-Sammelbestellung",
      locationId: berlin.id,
    },
  });

  console.log("Seed erfolgreich abgeschlossen");
}

main().finally(async () => prisma.$disconnect());
