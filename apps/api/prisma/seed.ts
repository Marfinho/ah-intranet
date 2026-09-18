/* eslint-disable no-console */
import { PrismaClient, type Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { MODULE_DEFINITIONS } from "@ah-intranet/shared";

const prisma = new PrismaClient();

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "Intranet2026!";

const LOCATIONS = [
  { name: "Hauptbetrieb Bremen", code: "HB", address: "Bremer Heerstraße 120, 28719 Bremen" },
  { name: "Filiale Delmenhorst", code: "DEL", address: "Oldenburger Straße 8, 27749 Delmenhorst" },
  { name: "Filiale Achim", code: "ACH", address: "Bremer Straße 44, 28832 Achim" },
];

const DEPARTMENTS = [
  { name: "Verkauf Neuwagen", code: "VKN" },
  { name: "Verkauf Gebrauchtwagen", code: "VKG" },
  { name: "Service & Werkstatt", code: "SRV" },
  { name: "Teiledienst", code: "TDI" },
  { name: "Verwaltung", code: "VWL" },
  { name: "Marketing", code: "MKT" },
  { name: "IT", code: "IT" },
];

const SPECIALTIES = [
  { name: "Elektromobilität", code: "EMOB" },
  { name: "Nutzfahrzeuge", code: "NFZ" },
  { name: "Karosserie & Lack", code: "KUL" },
];

const PERMISSIONS = [
  { key: "news.publish", name: "News veröffentlichen", description: "Beiträge erstellen und freigeben" },
  { key: "orders.approve", name: "Bestellungen freigeben", description: "Freigabeentscheidungen treffen" },
  { key: "orders.bulk", name: "Sammelbestellung auslösen", description: "Externe Sammelbestellung übergeben" },
  { key: "users.manage", name: "Benutzer verwalten", description: "Konten anlegen, ändern, deaktivieren" },
  { key: "roles.manage", name: "Rollen verwalten", description: "Rollen und Rechte pflegen" },
  { key: "modules.manage", name: "Module steuern", description: "Fachmodule aktivieren und deaktivieren" },
  { key: "catalog.manage", name: "Kataloge pflegen", description: "Artikel, Formularfelder, Bestelltermine" },
  { key: "tickets.manage", name: "Tickets bearbeiten", description: "Serviceanfragen zuweisen und lösen" },
  { key: "absences.approve", name: "Abwesenheiten freigeben", description: "Urlaubsanträge entscheiden" },
  { key: "audit.read", name: "Audit-Log lesen", description: "Protokoll aller Aktionen einsehen" },
];

const ROLES = [
  {
    key: "mitarbeiter",
    name: "Mitarbeitende",
    description: "Standardzugang: News lesen, bestellen, Tickets und Anträge stellen.",
    rank: 0,
    permissions: [] as string[],
  },
  {
    key: "fuehrungskraft",
    name: "Führungskraft",
    description: "Zusätzlich: Abwesenheiten des Teams freigeben und Termine anlegen.",
    rank: 10,
    permissions: ["absences.approve"],
  },
  {
    key: "fachbereichsadmin",
    name: "Fachbereichsadmin",
    description: "Redaktion und Freigaben: News, Bestellungen, Tickets, Kataloge.",
    rank: 20,
    permissions: ["news.publish", "orders.approve", "orders.bulk", "catalog.manage", "tickets.manage", "absences.approve"],
  },
  {
    key: "admin",
    name: "Administration",
    description: "Vollzugriff inklusive Benutzer, Rollen, Modulsteuerung und Audit.",
    rank: 30,
    permissions: PERMISSIONS.map((permission) => permission.key),
  },
];

interface SeedUser {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  roles: string[];
  location: string;
  department: string;
  specialty?: string;
  phone: string;
  mobile?: string;
  responsibilities: string[];
  manager?: string;
}

const USERS: SeedUser[] = [
  {
    username: "admin",
    firstName: "Markus",
    lastName: "Becker",
    email: "m.becker@autohaus-beispiel.de",
    jobTitle: "Geschäftsführung",
    roles: ["admin"],
    location: "HB",
    department: "VWL",
    phone: "0421 5550-100",
    mobile: "0171 5550100",
    responsibilities: ["Gesamtverantwortung", "Modulsteuerung", "Budget"],
  },
  {
    username: "s.meier",
    firstName: "Sandra",
    lastName: "Meier",
    email: "s.meier@autohaus-beispiel.de",
    jobTitle: "Leitung Verwaltung",
    roles: ["fachbereichsadmin", "fuehrungskraft"],
    location: "HB",
    department: "VWL",
    phone: "0421 5550-110",
    responsibilities: ["Bestellwesen", "Personalverwaltung", "Freigaben"],
    manager: "admin",
  },
  {
    username: "t.neumann",
    firstName: "Timo",
    lastName: "Neumann",
    email: "t.neumann@autohaus-beispiel.de",
    jobTitle: "Leitung Marketing",
    roles: ["fachbereichsadmin"],
    location: "HB",
    department: "MKT",
    phone: "0421 5550-120",
    responsibilities: ["Interne Kommunikation", "Visitenkarten", "Aktionen"],
    manager: "admin",
  },
  {
    username: "j.kruse",
    firstName: "Jana",
    lastName: "Kruse",
    email: "j.kruse@autohaus-beispiel.de",
    jobTitle: "Serviceleiterin",
    roles: ["fuehrungskraft"],
    location: "HB",
    department: "SRV",
    specialty: "EMOB",
    phone: "0421 5550-210",
    mobile: "0171 5550210",
    responsibilities: ["Werkstattplanung", "Hochvolt-Schulungen"],
    manager: "admin",
  },
  {
    username: "p.hansen",
    firstName: "Paul",
    lastName: "Hansen",
    email: "p.hansen@autohaus-beispiel.de",
    jobTitle: "Verkaufsberater Neuwagen",
    roles: ["mitarbeiter"],
    location: "HB",
    department: "VKN",
    specialty: "EMOB",
    phone: "0421 5550-310",
    mobile: "0171 5550310",
    responsibilities: ["Neuwagenverkauf", "Probefahrten"],
    manager: "admin",
  },
  {
    username: "l.schulz",
    firstName: "Lena",
    lastName: "Schulz",
    email: "l.schulz@autohaus-beispiel.de",
    jobTitle: "Serviceberaterin",
    roles: ["mitarbeiter"],
    location: "DEL",
    department: "SRV",
    phone: "04221 5550-220",
    responsibilities: ["Auftragsannahme", "Kundenbetreuung"],
    manager: "j.kruse",
  },
  {
    username: "d.wagner",
    firstName: "Dennis",
    lastName: "Wagner",
    email: "d.wagner@autohaus-beispiel.de",
    jobTitle: "Kfz-Mechatroniker",
    roles: ["mitarbeiter"],
    location: "DEL",
    department: "SRV",
    specialty: "KUL",
    phone: "04221 5550-230",
    responsibilities: ["Wartung", "Karosseriearbeiten"],
    manager: "j.kruse",
  },
  {
    username: "a.roth",
    firstName: "Anja",
    lastName: "Roth",
    email: "a.roth@autohaus-beispiel.de",
    jobTitle: "Teiledienst",
    roles: ["mitarbeiter"],
    location: "ACH",
    department: "TDI",
    phone: "04202 5550-240",
    responsibilities: ["Ersatzteillogistik", "Lagerverwaltung"],
    manager: "j.kruse",
  },
  {
    username: "f.oezdemir",
    firstName: "Fatih",
    lastName: "Özdemir",
    email: "f.oezdemir@autohaus-beispiel.de",
    jobTitle: "IT-Administrator",
    roles: ["fachbereichsadmin"],
    location: "HB",
    department: "IT",
    phone: "0421 5550-130",
    mobile: "0171 5550130",
    responsibilities: ["Arbeitsplätze", "Netzwerk", "Intranet"],
    manager: "admin",
  },
  {
    username: "c.bauer",
    firstName: "Clara",
    lastName: "Bauer",
    email: "c.bauer@autohaus-beispiel.de",
    jobTitle: "Verkaufsberaterin Gebrauchtwagen",
    roles: ["mitarbeiter"],
    location: "ACH",
    department: "VKG",
    phone: "04202 5550-320",
    responsibilities: ["Gebrauchtwagenankauf", "Fahrzeugbewertung"],
    manager: "admin",
  },
];

async function main() {
  console.log("Seed startet …");

  // Reihenfolge beachtet die Fremdschlüssel: abhängige Tabellen zuerst.
  await prisma.$transaction([
    prisma.pollVote.deleteMany(),
    prisma.pollOption.deleteMany(),
    prisma.poll.deleteMany(),
    prisma.ideaVote.deleteMany(),
    prisma.idea.deleteMany(),
    prisma.onboardingItem.deleteMany(),
    prisma.onboardingAssignment.deleteMany(),
    prisma.onboardingStep.deleteMany(),
    prisma.onboardingTemplate.deleteMany(),
    prisma.absence.deleteMany(),
    prisma.vehicleBooking.deleteMany(),
    prisma.vehicle.deleteMany(),
    prisma.roomBooking.deleteMany(),
    prisma.room.deleteMany(),
    prisma.ticketComment.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.calendarEvent.deleteMany(),
    prisma.wikiArticle.deleteMany(),
    prisma.document.deleteMany(),
    prisma.quickLink.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.newsRead.deleteMany(),
    prisma.newsComment.deleteMany(),
    prisma.newsAttachment.deleteMany(),
    prisma.newsPost.deleteMany(),
    prisma.approvalDecision.deleteMany(),
    prisma.workwearOrderItem.deleteMany(),
    prisma.workwearOrder.deleteMany(),
    prisma.businessCardOrderField.deleteMany(),
    prisma.businessCardOrder.deleteMany(),
    prisma.orderComment.deleteMany(),
    prisma.orderStatusHistory.deleteMany(),
    prisma.order.deleteMany(),
    prisma.orderCycle.deleteMany(),
    prisma.workwearItemSize.deleteMany(),
    prisma.workwearCatalogItem.deleteMany(),
    prisma.businessCardFieldDefinition.deleteMany(),
    prisma.approvalRule.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.locationDepartment.deleteMany(),
    prisma.user.deleteMany(),
    prisma.specialtyArea.deleteMany(),
    prisma.department.deleteMany(),
    prisma.location.deleteMany(),
  ]);

  /* ------------------------------------------------------- Organisation */

  await prisma.location.createMany({ data: LOCATIONS });
  await prisma.department.createMany({ data: DEPARTMENTS });
  await prisma.specialtyArea.createMany({ data: SPECIALTIES });

  const locations = await prisma.location.findMany();
  const departments = await prisma.department.findMany();
  const specialties = await prisma.specialtyArea.findMany();

  const locationByCode = new Map(locations.map((entry) => [entry.code, entry]));
  const departmentByCode = new Map(departments.map((entry) => [entry.code, entry]));
  const specialtyByCode = new Map(specialties.map((entry) => [entry.code, entry]));

  await prisma.locationDepartment.createMany({
    data: locations.flatMap((location) =>
      departments.map((department) => ({ locationId: location.id, departmentId: department.id })),
    ),
    skipDuplicates: true,
  });

  /* ------------------------------------------------------ Rollen/Rechte */

  await prisma.permission.createMany({ data: PERMISSIONS });
  const permissions = await prisma.permission.findMany();
  const permissionByKey = new Map(permissions.map((entry) => [entry.key, entry]));

  for (const role of ROLES) {
    await prisma.role.create({
      data: {
        key: role.key,
        name: role.name,
        description: role.description,
        rank: role.rank,
        permissions: {
          create: role.permissions.map((key) => ({ permissionId: permissionByKey.get(key)!.id })),
        },
      },
    });
  }
  const roles = await prisma.role.findMany();
  const roleByKey = new Map(roles.map((entry) => [entry.key, entry]));

  /* ---------------------------------------------------------- Benutzer */

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const userByUsername = new Map<string, { id: string }>();

  for (const seedUser of USERS) {
    const location = locationByCode.get(seedUser.location)!;
    const department = departmentByCode.get(seedUser.department)!;
    const specialty = seedUser.specialty ? specialtyByCode.get(seedUser.specialty) : undefined;

    const created = await prisma.user.create({
      data: {
        username: seedUser.username,
        email: seedUser.email,
        passwordHash,
        firstName: seedUser.firstName,
        lastName: seedUser.lastName,
        jobTitle: seedUser.jobTitle,
        phone: seedUser.phone,
        mobile: seedUser.mobile ?? null,
        responsibilities: seedUser.responsibilities,
        locationId: location.id,
        departmentId: department.id,
        specialtyAreaId: specialty?.id ?? null,
        scopes: [
          "global",
          `location:${location.code}`,
          `department:${department.code}`,
          ...(specialty ? [`specialty:${specialty.code}`] : []),
        ],
        roles: { create: seedUser.roles.map((key) => ({ roleId: roleByKey.get(key)!.id })) },
      },
    });
    userByUsername.set(seedUser.username, created);
  }

  // Vorgesetzte erst nachtragen, wenn alle Konten existieren.
  for (const seedUser of USERS.filter((entry) => entry.manager)) {
    await prisma.user.update({
      where: { id: userByUsername.get(seedUser.username)!.id },
      data: { managerId: userByUsername.get(seedUser.manager!)!.id },
    });
  }

  const admin = userByUsername.get("admin")!;
  const sandra = userByUsername.get("s.meier")!;
  const timo = userByUsername.get("t.neumann")!;
  const jana = userByUsername.get("j.kruse")!;
  const paul = userByUsername.get("p.hansen")!;
  const lena = userByUsername.get("l.schulz")!;
  const dennis = userByUsername.get("d.wagner")!;
  const fatih = userByUsername.get("f.oezdemir")!;
  const clara = userByUsername.get("c.bauer")!;

  /* ------------------------------------------------------------- Module */

  await prisma.moduleSetting.createMany({
    data: MODULE_DEFINITIONS.map((module) => ({ key: module.key, enabled: module.defaultEnabled })),
    skipDuplicates: true,
  });

  /* --------------------------------------------------------------- News */

  const days = (offset: number) => new Date(Date.now() + offset * 24 * 60 * 60 * 1000);

  const newsSeed: Prisma.NewsPostCreateInput[] = [
    {
      slug: "neue-hochvolt-schulung",
      title: "Pflichtschulung Hochvolt-Technik im Februar",
      teaser: "Alle Servicemitarbeitenden absolvieren die aktualisierte HV-Schulung bis Ende Februar.",
      content:
        "Die Herstellervorgaben zur Hochvolt-Qualifikation wurden verschärft. Alle Mitarbeitenden im Service " +
        "benötigen die aufgefrischte Zertifizierung. Die Termine stehen im Kalender; die Anmeldung läuft über " +
        "die Serviceleitung. Ohne gültige Qualifikation dürfen ab dem 1. März keine Arbeiten an Hochvoltsystemen " +
        "ausgeführt werden.",
      priority: "kritisch",
      status: "published",
      pinned: true,
      publishedAt: days(-2),
      audienceScopes: ["department:SRV", "specialty:EMOB"],
      author: { connect: { id: jana.id } },
    },
    {
      slug: "sommeraktion-gebrauchtwagen",
      title: "Sommeraktion Gebrauchtwagen startet",
      teaser: "Ab Montag läuft die Aktion mit erweiterter Garantie auf alle Fahrzeuge unter 60.000 km.",
      content:
        "Die Aktionsunterlagen liegen in der Dokumentenzentrale bereit. Bitte verwenden Sie ausschließlich die " +
        "freigegebenen Preisschilder und Aushänge. Fragen zur Abwicklung beantwortet das Marketing.",
      priority: "hoch",
      status: "published",
      publishedAt: days(-5),
      audienceScopes: ["department:VKG", "department:VKN", "department:MKT"],
      author: { connect: { id: timo.id } },
    },
    {
      slug: "neue-bestellfristen",
      title: "Neue Fristen für Sammelbestellungen",
      teaser: "Visitenkarten und Arbeitskleidung werden künftig monatlich gebündelt bestellt.",
      content:
        "Um Versandkosten zu senken, bündeln wir Bestellungen künftig monatlich. Maßgeblich ist der im Intranet " +
        "hinterlegte Bestelltermin. Bestellungen, die nach dem Stichtag freigegeben werden, laufen in den Folgemonat.",
      priority: "normal",
      status: "published",
      publishedAt: days(-9),
      audienceScopes: ["global"],
      author: { connect: { id: sandra.id } },
    },
    {
      slug: "wartungsfenster-dms",
      title: "Wartungsfenster Warenwirtschaft am Samstag",
      teaser: "Am Samstag von 6 bis 10 Uhr ist das DMS nicht erreichbar.",
      content:
        "Die IT spielt ein Sicherheitsupdate ein. Bitte schließen Sie alle Vorgänge am Freitag ab. " +
        "Während des Wartungsfensters stehen Fahrzeugakte und Teiledienst-Module nicht zur Verfügung.",
      priority: "hoch",
      status: "published",
      publishedAt: days(-1),
      audienceScopes: ["global"],
      author: { connect: { id: fatih.id } },
    },
    {
      slug: "entwurf-weihnachtsfeier",
      title: "Planung Betriebsfeier",
      teaser: "Terminvorschläge werden gesammelt.",
      content: "Entwurf - die Abstimmung über den Termin folgt als Umfrage.",
      priority: "niedrig",
      status: "draft",
      audienceScopes: ["global"],
      author: { connect: { id: timo.id } },
    },
  ];

  for (const entry of newsSeed) {
    await prisma.newsPost.create({ data: entry });
  }

  const hvNews = await prisma.newsPost.findUniqueOrThrow({ where: { slug: "neue-hochvolt-schulung" } });
  await prisma.newsComment.createMany({
    data: [
      { newsPostId: hvNews.id, authorId: dennis.id, message: "Ich habe die Schulung schon im Januar gemacht - zählt die?" },
      { newsPostId: hvNews.id, authorId: jana.id, message: "Ja, Januar-Termine sind gültig. Ich trage dich in die Liste ein." },
    ],
  });
  await prisma.newsRead.createMany({ data: [{ newsPostId: hvNews.id, userId: jana.id }] });

  /* ------------------------------------------------- Bestellstammdaten */

  await prisma.businessCardFieldDefinition.createMany({
    data: [
      { key: "fullName", label: "Name", fieldType: "text", sortOrder: 0, isRequired: true, options: [] },
      { key: "jobTitle", label: "Funktionsbezeichnung", fieldType: "text", sortOrder: 1, isRequired: true, options: [] },
      {
        key: "location",
        label: "Standort",
        fieldType: "select",
        sortOrder: 2,
        isRequired: true,
        options: LOCATIONS.map((entry) => entry.name),
      },
      { key: "phone", label: "Telefon", fieldType: "phone", sortOrder: 3, isRequired: true, options: [] },
      { key: "mobile", label: "Mobil", fieldType: "phone", sortOrder: 4, isRequired: false, options: [] },
      { key: "email", label: "E-Mail", fieldType: "email", sortOrder: 5, isRequired: true, options: [] },
      {
        key: "qrCode",
        label: "QR-Code mit Kontaktdaten aufdrucken",
        fieldType: "checkbox",
        sortOrder: 6,
        isRequired: false,
        options: [],
        helpText: "Der QR-Code enthält die Kontaktdaten als vCard.",
      },
    ],
  });

  const workwear = [
    { name: "Poloshirt Service", category: "Oberteile", sizes: ["S", "M", "L", "XL", "XXL"], description: "Kurzarm, mit Logo-Stick" },
    { name: "Softshelljacke", category: "Oberteile", sizes: ["S", "M", "L", "XL", "XXL"], description: "Wind- und wasserabweisend" },
    { name: "Arbeitshose Werkstatt", category: "Hosen", sizes: ["46", "48", "50", "52", "54", "56"], description: "Mit Kniepolstertaschen" },
    { name: "Sicherheitsschuhe S3", category: "Schuhe", sizes: ["39", "40", "41", "42", "43", "44", "45", "46"], description: "Durchtrittsicher" },
    { name: "Hemd Verkauf", category: "Oberteile", sizes: ["38", "39", "40", "41", "42", "43"], description: "Langarm, bügelleicht" },
  ];

  for (const item of workwear) {
    await prisma.workwearCatalogItem.create({
      data: {
        name: item.name,
        category: item.category,
        description: item.description,
        sizes: { create: item.sizes.map((sizeLabel, index) => ({ sizeLabel, sortOrder: index })) },
      },
    });
  }

  await prisma.orderCycle.createMany({
    data: [
      {
        cycleType: "business_cards",
        title: "Sammelbestellung Visitenkarten",
        nextOrderDate: days(12),
        notes: "Freigaben bis 3 Werktage vor dem Termin.",
      },
      {
        cycleType: "workwear",
        title: "Sammelbestellung Arbeitskleidung",
        nextOrderDate: days(26),
        notes: "Größenumtausch nur innerhalb von 14 Tagen nach Lieferung.",
      },
    ],
  });

  /* ------------------------------------------------------- Bestellungen */

  const bcFields = await prisma.businessCardFieldDefinition.findMany();
  const fieldByKey = new Map(bcFields.map((entry) => [entry.key, entry]));
  const bcCycle = await prisma.orderCycle.findFirstOrThrow({ where: { cycleType: "business_cards" } });
  const wwCycle = await prisma.orderCycle.findFirstOrThrow({ where: { cycleType: "workwear" } });

  await prisma.order.create({
    data: {
      orderNumber: "BC-00001",
      type: "business_card",
      requesterId: paul.id,
      status: "submitted",
      submittedAt: days(-3),
      orderCycleId: bcCycle.id,
      statusHistory: { create: [{ status: "submitted", note: "Bestellung eingereicht", actorName: "Paul Hansen", changedAt: days(-3) }] },
      businessCardOrder: {
        create: {
          quantity: 250,
          fields: {
            create: [
              { fieldDefinitionId: fieldByKey.get("fullName")!.id, value: "Paul Hansen" },
              { fieldDefinitionId: fieldByKey.get("jobTitle")!.id, value: "Verkaufsberater Neuwagen" },
              { fieldDefinitionId: fieldByKey.get("location")!.id, value: "Hauptbetrieb Bremen" },
              { fieldDefinitionId: fieldByKey.get("phone")!.id, value: "0421 5550-310" },
              { fieldDefinitionId: fieldByKey.get("mobile")!.id, value: "0171 5550310" },
              { fieldDefinitionId: fieldByKey.get("email")!.id, value: "p.hansen@autohaus-beispiel.de" },
              { fieldDefinitionId: fieldByKey.get("qrCode")!.id, value: "true" },
            ],
          },
        },
      },
      comments: { create: [{ authorId: sandra.id, message: "Bitte prüfe noch die Schreibweise der Mobilnummer.", createdAt: days(-2) }] },
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: "BC-00002",
      type: "business_card",
      requesterId: clara.id,
      status: "approved",
      submittedAt: days(-10),
      approvedAt: days(-8),
      orderCycleId: bcCycle.id,
      statusHistory: {
        create: [
          { status: "submitted", note: "Bestellung eingereicht", actorName: "Clara Bauer", changedAt: days(-10) },
          { status: "approved", note: "Freigegeben", actorName: "Sandra Meier", changedAt: days(-8) },
        ],
      },
      approvalDecisions: { create: [{ actorId: sandra.id, decision: "approved", note: "Freigegeben", decidedAt: days(-8) }] },
      businessCardOrder: {
        create: {
          quantity: 100,
          fields: {
            create: [
              { fieldDefinitionId: fieldByKey.get("fullName")!.id, value: "Clara Bauer" },
              { fieldDefinitionId: fieldByKey.get("jobTitle")!.id, value: "Verkaufsberaterin Gebrauchtwagen" },
              { fieldDefinitionId: fieldByKey.get("location")!.id, value: "Filiale Achim" },
              { fieldDefinitionId: fieldByKey.get("phone")!.id, value: "04202 5550-320" },
              { fieldDefinitionId: fieldByKey.get("email")!.id, value: "c.bauer@autohaus-beispiel.de" },
            ],
          },
        },
      },
    },
  });

  const polo = await prisma.workwearCatalogItem.findFirstOrThrow({ where: { name: "Poloshirt Service" } });
  const hose = await prisma.workwearCatalogItem.findFirstOrThrow({ where: { name: "Arbeitshose Werkstatt" } });
  const schuhe = await prisma.workwearCatalogItem.findFirstOrThrow({ where: { name: "Sicherheitsschuhe S3" } });

  await prisma.order.create({
    data: {
      orderNumber: "WW-00001",
      type: "workwear",
      requesterId: dennis.id,
      status: "submitted",
      submittedAt: days(-1),
      orderCycleId: wwCycle.id,
      statusHistory: { create: [{ status: "submitted", note: "Bestellung eingereicht", actorName: "Dennis Wagner", changedAt: days(-1) }] },
      workwearOrder: {
        create: {
          items: {
            create: [
              { catalogItemId: polo.id, sizeLabel: "L", quantity: 3 },
              { catalogItemId: hose.id, sizeLabel: "50", quantity: 2 },
              { catalogItemId: schuhe.id, sizeLabel: "43", quantity: 1 },
            ],
          },
        },
      },
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: "WW-00002",
      type: "workwear",
      requesterId: lena.id,
      status: "completed",
      submittedAt: days(-40),
      approvedAt: days(-38),
      orderedAt: days(-30),
      completedAt: days(-20),
      statusHistory: {
        create: [
          { status: "submitted", note: "Bestellung eingereicht", actorName: "Lena Schulz", changedAt: days(-40) },
          { status: "approved", note: "Freigegeben", actorName: "Sandra Meier", changedAt: days(-38) },
          { status: "ordered", note: "Sammelbestellung übergeben", actorName: "Sandra Meier", changedAt: days(-30) },
          { status: "completed", note: "Ware übergeben", actorName: "Sandra Meier", changedAt: days(-20) },
        ],
      },
      workwearOrder: { create: { items: { create: [{ catalogItemId: polo.id, sizeLabel: "M", quantity: 2 }] } } },
    },
  });

  /* ---------------------------------------------------------- Dokumente */

  await prisma.document.createMany({
    data: [
      {
        title: "Arbeitsanweisung Fahrzeugannahme",
        category: "Prozesse",
        description: "Ablauf der Direktannahme inklusive Checkliste.",
        fileType: "pdf",
        url: "/dokumente/arbeitsanweisung-fahrzeugannahme.pdf",
        ownerId: jana.id,
        audienceScopes: ["department:SRV"],
      },
      {
        title: "Reisekostenabrechnung (Formular)",
        category: "Formulare",
        description: "Vorlage für Reisekosten inklusive Pauschalen.",
        fileType: "xlsx",
        url: "/dokumente/reisekosten.xlsx",
        ownerId: sandra.id,
        audienceScopes: ["global"],
      },
      {
        title: "Corporate Design Handbuch",
        category: "Marketing",
        description: "Logos, Farben, Schriften und Anwendungsbeispiele.",
        fileType: "pdf",
        url: "/dokumente/cd-handbuch.pdf",
        ownerId: timo.id,
        audienceScopes: ["global"],
      },
      {
        title: "Notfallplan und Ersthelfer",
        category: "Arbeitssicherheit",
        description: "Aushang mit Ersthelfern und Sammelplätzen je Standort.",
        fileType: "pdf",
        url: "/dokumente/notfallplan.pdf",
        ownerId: sandra.id,
        audienceScopes: ["global"],
      },
      {
        title: "IT-Nutzungsrichtlinie",
        category: "IT",
        description: "Regeln für Arbeitsplätze, Mobilgeräte und Passwörter.",
        fileType: "pdf",
        url: "/dokumente/it-richtlinie.pdf",
        ownerId: fatih.id,
        audienceScopes: ["global"],
      },
      {
        title: "Preisliste Ersatzteile Q1",
        category: "Teiledienst",
        description: "Aktuelle Konditionen und Rabattstaffeln.",
        fileType: "xlsx",
        url: "/dokumente/preisliste-q1.xlsx",
        ownerId: sandra.id,
        audienceScopes: ["department:TDI", "department:SRV"],
      },
    ],
  });

  /* --------------------------------------------------------------- Wiki */

  await prisma.wikiArticle.createMany({
    data: [
      {
        slug: "direktannahme-schritt-fuer-schritt",
        title: "Direktannahme Schritt für Schritt",
        category: "Service",
        content:
          "Die Direktannahme beginnt mit der Begrüßung am Fahrzeug. Fahrzeugdaten werden über den Fahrzeugschein " +
          "erfasst, anschließend erfolgt der gemeinsame Rundgang mit der Kundin oder dem Kunden. Auffälligkeiten " +
          "werden fotografiert und im Auftrag dokumentiert. Nach der Probefahrt wird der Auftragsumfang festgelegt " +
          "und schriftlich bestätigt. Erst danach beginnt die Werkstattarbeit.",
        tags: ["service", "annahme", "prozess"],
        authorId: jana.id,
      },
      {
        slug: "vpn-zugang-einrichten",
        title: "VPN-Zugang einrichten",
        category: "IT",
        content:
          "Der VPN-Zugang wird über den IT-Servicedesk beantragt. Nach der Freigabe erhalten Sie eine " +
          "Konfigurationsdatei und einen Einmalcode. Installieren Sie den Client, importieren Sie das Profil und " +
          "melden Sie sich mit Ihren Windows-Zugangsdaten plus zweitem Faktor an. Bei Problemen hilft ein Ticket " +
          "in der Kategorie IT.",
        tags: ["it", "vpn", "homeoffice"],
        authorId: fatih.id,
      },
      {
        slug: "probefahrt-abwicklung",
        title: "Probefahrt richtig abwickeln",
        category: "Verkauf",
        content:
          "Vor jeder Probefahrt werden Führerschein geprüft und kopiert sowie der Probefahrtvertrag unterschrieben. " +
          "Das rote Kennzeichen wird im Fahrtenbuch eingetragen. Nach der Rückkehr erfolgt eine Sichtprüfung, " +
          "der Tankstand wird notiert und das Fahrzeug für die nächste Vorführung vorbereitet.",
        tags: ["verkauf", "probefahrt", "recht"],
        authorId: paul.id,
      },
      {
        slug: "hochvolt-sicherheitsregeln",
        title: "Hochvolt-Sicherheitsregeln",
        category: "Service",
        content:
          "Arbeiten an Hochvoltsystemen dürfen ausschließlich von qualifizierten Personen ausgeführt werden. " +
          "Das Fahrzeug wird spannungsfrei geschaltet, gegen Wiedereinschalten gesichert und die Spannungsfreiheit " +
          "wird gemessen. Schutzausrüstung ist verpflichtend. Der Arbeitsbereich wird abgesperrt und gekennzeichnet.",
        tags: ["service", "hochvolt", "sicherheit"],
        authorId: jana.id,
      },
    ],
  });

  /* ------------------------------------------------------ Schnellzugriffe */

  await prisma.quickLink.createMany({
    data: [
      { label: "Zeiterfassung", url: "https://zeiterfassung.example.com", description: "Kommen, Gehen, Korrekturen", icon: "Clock", sortOrder: 0 },
      { label: "Warenwirtschaft (DMS)", url: "https://dms.example.com", description: "Fahrzeugakte und Aufträge", icon: "Database", sortOrder: 1 },
      { label: "Herstellerportal", url: "https://partner.example.com", description: "Technische Unterlagen und Rückrufe", icon: "Factory", sortOrder: 2 },
      { label: "Teilekatalog", url: "https://teile.example.com", description: "Ersatzteilsuche", icon: "Wrench", sortOrder: 3, audienceScopes: ["department:TDI", "department:SRV"] },
      { label: "IT-Servicedesk", url: "https://support.example.com", description: "Störungen melden", icon: "LifeBuoy", sortOrder: 4 },
    ],
  });

  /* ----------------------------------------------------------- Kalender */

  await prisma.calendarEvent.createMany({
    data: [
      {
        title: "Hochvolt-Schulung Teil 1",
        category: "schulung",
        startsAt: days(6),
        endsAt: days(6),
        location: "Schulungsraum Bremen",
        description: "Grundlagen und Sicherheitsregeln",
        audienceScopes: ["department:SRV", "specialty:EMOB"],
        organizerId: jana.id,
      },
      {
        title: "Verkaufsmeeting Q1",
        category: "meeting",
        startsAt: days(3),
        endsAt: days(3),
        location: "Besprechungsraum Nord",
        description: "Zielerreichung und Aktionsplanung",
        audienceScopes: ["department:VKN", "department:VKG"],
        organizerId: admin.id,
      },
      {
        title: "Wartungsfenster DMS",
        category: "wartung",
        startsAt: days(4),
        endsAt: days(4),
        location: "Remote",
        description: "Sicherheitsupdate, System nicht erreichbar",
        audienceScopes: ["global"],
        organizerId: fatih.id,
      },
      {
        title: "Sommeraktion Gebrauchtwagen",
        category: "aktion",
        startsAt: days(14),
        endsAt: days(45),
        location: "Alle Standorte",
        description: "Aktionszeitraum mit erweiterter Garantie",
        audienceScopes: ["global"],
        organizerId: timo.id,
      },
      {
        title: "Sammelbestellung Visitenkarten",
        category: "bestellung",
        startsAt: days(12),
        endsAt: days(12),
        location: "Verwaltung",
        description: "Stichtag für Freigaben",
        audienceScopes: ["global"],
        organizerId: sandra.id,
      },
    ],
  });

  /* ------------------------------------------------------ Räume & Fuhrpark */

  const bremen = locationByCode.get("HB")!;
  const delmenhorst = locationByCode.get("DEL")!;

  await prisma.room.createMany({
    data: [
      { name: "Besprechungsraum Nord", locationId: bremen.id, capacity: 12, equipment: ["Beamer", "Whiteboard", "Videokonferenz"] },
      { name: "Schulungsraum Bremen", locationId: bremen.id, capacity: 24, equipment: ["Beamer", "Flipchart"] },
      { name: "Besprechungsraum Delmenhorst", locationId: delmenhorst.id, capacity: 8, equipment: ["TV", "Whiteboard"] },
    ],
  });

  const raumNord = await prisma.room.findFirstOrThrow({ where: { name: "Besprechungsraum Nord" } });
  await prisma.roomBooking.create({
    data: { roomId: raumNord.id, userId: admin.id, title: "Verkaufsmeeting Q1", startsAt: days(3), endsAt: days(3) },
  });

  await prisma.vehicle.createMany({
    data: [
      { label: "Vorführwagen Kompakt-SUV", plate: "HB-AH 101", category: "vorfuehrwagen", locationId: bremen.id, notes: "Vollelektrisch" },
      { label: "Vorführwagen Kombi", plate: "HB-AH 102", category: "vorfuehrwagen", locationId: bremen.id },
      { label: "Werkstattersatzwagen Kleinwagen", plate: "DEL-AH 201", category: "werkstattersatz", locationId: delmenhorst.id },
      { label: "Poolfahrzeug Transporter", plate: "HB-AH 301", category: "poolfahrzeug", locationId: bremen.id, notes: "Für Teiletransporte" },
    ],
  });

  const poolTransporter = await prisma.vehicle.findFirstOrThrow({ where: { plate: "HB-AH 301" } });
  await prisma.vehicleBooking.create({
    data: {
      vehicleId: poolTransporter.id,
      userId: userByUsername.get("a.roth")!.id,
      purpose: "Teileabholung Zentrallager",
      startsAt: days(2),
      endsAt: days(2),
    },
  });

  /* ------------------------------------------------------------ Tickets */

  const ticket1 = await prisma.ticket.create({
    data: {
      number: "TIC-00001",
      title: "Drucker Teiledienst druckt nicht",
      description: "Der Etikettendrucker im Teiledienst reagiert seit heute Morgen nicht mehr.",
      category: "it",
      priority: "hoch",
      status: "in_bearbeitung",
      requesterId: userByUsername.get("a.roth")!.id,
      assigneeId: fatih.id,
    },
  });
  await prisma.ticketComment.createMany({
    data: [
      { ticketId: ticket1.id, authorId: fatih.id, message: "Ich prüfe den Druckertreiber und melde mich in einer Stunde." },
      { ticketId: ticket1.id, authorId: userByUsername.get("a.roth")!.id, message: "Danke, die Etiketten werden dringend gebraucht." },
    ],
  });

  await prisma.ticket.createMany({
    data: [
      {
        number: "TIC-00002",
        title: "Zusätzliche Spindschlüssel benötigt",
        description: "Zwei neue Kolleginnen benötigen Spindschlüssel für die Umkleide Delmenhorst.",
        category: "facility",
        priority: "normal",
        status: "offen",
        requesterId: lena.id,
      },
      {
        number: "TIC-00003",
        title: "Aktionsplakate nachbestellen",
        description: "Für die Sommeraktion fehlen Plakate im Format A1 am Standort Achim.",
        category: "marketing",
        priority: "normal",
        status: "wartet_auf_rueckmeldung",
        requesterId: clara.id,
        assigneeId: timo.id,
      },
      {
        number: "TIC-00004",
        title: "Bescheinigung für Elternzeit",
        description: "Ich benötige eine Bescheinigung für den Antrag auf Elterngeld.",
        category: "hr",
        priority: "normal",
        status: "geloest",
        requesterId: dennis.id,
        assigneeId: sandra.id,
        closedAt: days(-4),
      },
    ],
  });

  /* --------------------------------------------------------- Onboarding */

  const onboardingService = await prisma.onboardingTemplate.create({
    data: {
      name: "Onboarding Service",
      targetRole: "Serviceberatung und Werkstatt",
      durationLabel: "4 Wochen",
      steps: {
        create: [
          { title: "Arbeitsvertrag und Stammdaten erfassen", ownerRole: "Verwaltung", sortOrder: 0 },
          { title: "Zugänge und Arbeitsplatz einrichten", ownerRole: "IT", sortOrder: 1 },
          { title: "Arbeitskleidung bestellen", ownerRole: "Verwaltung", sortOrder: 2 },
          { title: "Sicherheitsunterweisung", ownerRole: "Serviceleitung", sortOrder: 3 },
          { title: "Einweisung Direktannahme", ownerRole: "Serviceleitung", sortOrder: 4 },
          { title: "Hospitation Teiledienst", ownerRole: "Teiledienst", sortOrder: 5, isRequired: false },
        ],
      },
    },
    include: { steps: true },
  });

  await prisma.onboardingTemplate.create({
    data: {
      name: "Onboarding Verkauf",
      targetRole: "Verkaufsberatung",
      durationLabel: "6 Wochen",
      steps: {
        create: [
          { title: "Arbeitsvertrag und Stammdaten erfassen", ownerRole: "Verwaltung", sortOrder: 0 },
          { title: "Zugänge und Arbeitsplatz einrichten", ownerRole: "IT", sortOrder: 1 },
          { title: "Visitenkarten bestellen", ownerRole: "Marketing", sortOrder: 2 },
          { title: "Produktschulung Hersteller", ownerRole: "Verkaufsleitung", sortOrder: 3 },
          { title: "Begleitung Probefahrten", ownerRole: "Verkaufsleitung", sortOrder: 4 },
          { title: "Einführung Finanzierungsangebote", ownerRole: "Verwaltung", sortOrder: 5 },
        ],
      },
    },
  });

  await prisma.onboardingAssignment.create({
    data: {
      templateId: onboardingService.id,
      userId: dennis.id,
      startDate: days(-14),
      items: {
        create: onboardingService.steps.map((step, index) => ({
          stepId: step.id,
          done: index < 3,
          doneAt: index < 3 ? days(-10 + index) : null,
        })),
      },
    },
  });

  /* ------------------------------------------------------ Abwesenheiten */

  await prisma.absence.createMany({
    data: [
      {
        userId: paul.id,
        type: "urlaub",
        startDate: days(20),
        endDate: days(31),
        workingDays: 8,
        status: "submitted",
        note: "Sommerurlaub, Vertretung ist abgestimmt.",
      },
      {
        userId: lena.id,
        type: "urlaub",
        startDate: days(-30),
        endDate: days(-24),
        workingDays: 5,
        status: "approved",
        deciderId: jana.id,
        decidedAt: days(-35),
      },
      {
        userId: dennis.id,
        type: "fortbildung",
        startDate: days(6),
        endDate: days(7),
        workingDays: 2,
        status: "approved",
        note: "Hochvolt-Schulung",
        deciderId: jana.id,
        decidedAt: days(-1),
      },
    ],
  });

  /* ------------------------------------------------------ Ideen & Umfragen */

  const idea1 = await prisma.idea.create({
    data: {
      title: "Ladesäulen für Mitarbeitende",
      description:
        "Zwei der Ladepunkte auf dem Mitarbeiterparkplatz könnten außerhalb der Stoßzeiten für private " +
        "E-Fahrzeuge freigegeben werden - gegen Abrechnung über die Lohnabrechnung.",
      category: "Arbeitsumfeld",
      status: "in_pruefung",
      authorId: paul.id,
    },
  });
  const idea2 = await prisma.idea.create({
    data: {
      title: "Digitale Checkliste für die Direktannahme",
      description: "Statt Papierbögen eine Tablet-Checkliste, die direkt in den Auftrag übernommen wird.",
      category: "Prozesse",
      status: "neu",
      authorId: lena.id,
    },
  });
  await prisma.ideaVote.createMany({
    data: [
      { ideaId: idea1.id, userId: lena.id },
      { ideaId: idea1.id, userId: dennis.id },
      { ideaId: idea1.id, userId: clara.id },
      { ideaId: idea2.id, userId: jana.id },
      { ideaId: idea2.id, userId: dennis.id },
    ],
  });

  const poll = await prisma.poll.create({
    data: {
      question: "Wann soll die Betriebsfeier stattfinden?",
      description: "Bitte stimmen Sie bis Ende des Monats ab.",
      closesAt: days(18),
      authorId: timo.id,
      options: {
        create: [
          { label: "Freitagabend", sortOrder: 0 },
          { label: "Samstagnachmittag", sortOrder: 1 },
          { label: "Sonntagsbrunch", sortOrder: 2 },
        ],
      },
    },
    include: { options: true },
  });
  await prisma.pollVote.createMany({
    data: [
      { pollId: poll.id, optionId: poll.options[0].id, userId: paul.id },
      { pollId: poll.id, optionId: poll.options[0].id, userId: dennis.id },
      { pollId: poll.id, optionId: poll.options[1].id, userId: lena.id },
      { pollId: poll.id, optionId: poll.options[1].id, userId: clara.id },
      { pollId: poll.id, optionId: poll.options[2].id, userId: jana.id },
    ],
  });

  /* --------------------------------------------- Benachrichtigungen/Audit */

  await prisma.notification.createMany({
    data: [
      {
        userId: paul.id,
        title: "Rückfrage zu BC-00001",
        detail: "Bitte prüfe noch die Schreibweise der Mobilnummer.",
        link: "/bestellungen/meine",
      },
      {
        userId: sandra.id,
        title: "Neue Freigabe: WW-00001",
        detail: "Dennis Wagner · Arbeitskleidung, 3 Positionen",
        link: "/freigaben",
      },
      {
        userId: dennis.id,
        title: "Wichtige News: Pflichtschulung Hochvolt-Technik",
        detail: "Alle Servicemitarbeitenden absolvieren die HV-Schulung bis Ende Februar.",
        link: "/aktuelles/neue-hochvolt-schulung",
      },
      {
        userId: jana.id,
        title: "Abwesenheitsantrag von Paul Hansen",
        detail: "Urlaub, 8 Arbeitstage",
        link: "/abwesenheiten",
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        actorId: admin.id,
        actorUsername: "admin",
        action: "system.seed",
        entityType: "system",
        entityId: "seed",
        detail: "Demodaten eingespielt",
      },
      {
        actorId: sandra.id,
        actorUsername: "s.meier",
        action: "order.approved",
        entityType: "order",
        entityId: "BC-00002",
        detail: "BC-00002: Genehmigt",
      },
      {
        actorId: jana.id,
        actorUsername: "j.kruse",
        action: "news.create",
        entityType: "news",
        entityId: hvNews.id,
        detail: 'Beitrag "Pflichtschulung Hochvolt-Technik im Februar" veröffentlicht',
      },
    ],
  });

  const counts = {
    Benutzer: await prisma.user.count(),
    Rollen: await prisma.role.count(),
    Module: await prisma.moduleSetting.count(),
    News: await prisma.newsPost.count(),
    Bestellungen: await prisma.order.count(),
    Dokumente: await prisma.document.count(),
    "Wiki-Artikel": await prisma.wikiArticle.count(),
    Termine: await prisma.calendarEvent.count(),
    Tickets: await prisma.ticket.count(),
    Fahrzeuge: await prisma.vehicle.count(),
  };

  console.log("Seed abgeschlossen:", counts);
  console.log(`Alle Demokonten nutzen das Passwort: ${DEMO_PASSWORD}`);
  console.log("Anmeldung z. B. als admin / s.meier / p.hansen / d.wagner");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
