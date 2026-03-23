import type {
  ApprovalTask,
  AuditLogItem,
  BusinessCardFieldDefinition,
  BusinessCardOrder,
  CalendarEvent,
  DashboardMetric,
  DocumentItem,
  EmployeeDirectoryEntry,
  NewsItem,
  NotificationItem,
  OnboardingTemplate,
  OrderCycleInfo,
  RoleSummary,
  TicketSummary,
  UserSummary,
  WorkwearCatalogItem,
  WorkwearOrder,
} from "./types";

export const currentUser: UserSummary = {
  username: "service.mitte",
  displayName: "Anna Richter",
  role: "mitarbeiter",
  scope: "Berlin Mitte / Service",
  email: "anna.richter@autohaus.local",
  location: "Berlin Mitte",
  department: "Service",
  specialtyArea: "Kundendienst",
};

export const dashboardMetrics: DashboardMetric[] = [
  { label: "Offene Freigaben", value: "12", helper: "6 Visitenkarten · 6 Arbeitskleidung" },
  { label: "Wichtige Meldungen", value: "3", helper: "1 kritisch, 2 hoch priorisiert" },
  { label: "Bestellungen im Zyklus", value: "29", helper: "Nächster Sammellauf in 4 Tagen" },
  { label: "Aktive Mitarbeitende", value: "148", helper: "3 Standorte · 7 Fachbereiche vorbereitet" },
];

export const notifications: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Visitenkartenbestellung freigegeben",
    detail: "Ihre Bestellung BC-2026-001 wurde genehmigt und für die Sammelbestellung vorgemerkt.",
    channel: "in_app",
    createdAt: "2026-03-21T10:04:00.000Z",
    read: false,
    link: "/bestellungen/meine",
  },
  {
    id: "notif-2",
    title: "Kritische IT-Wartung veröffentlicht",
    detail: "Bitte beachten Sie die temporären Einschränkungen der Telefonie am Samstag.",
    channel: "email",
    createdAt: "2026-03-22T15:00:00.000Z",
    read: false,
    link: "/aktuelles/it-wartung-telefonie",
  },
  {
    id: "notif-3",
    title: "Onboarding-Paket für neue Kollegin vorbereitet",
    detail: "Die Aufgabenliste für den Start im Verkauf wurde veröffentlicht.",
    channel: "in_app",
    createdAt: "2026-03-23T07:45:00.000Z",
    read: true,
    link: "/onboarding",
  },
];

export const orderCycles: OrderCycleInfo[] = [
  {
    id: "cycle-bc-2026-03",
    type: "business_cards",
    label: "Visitenkarten",
    nextOrderDate: "2026-03-27T12:00:00.000Z",
    notes: "Sammelbestellung jeden Freitag um 12:00 Uhr",
    scope: "Global, später pro Standort erweiterbar",
  },
  {
    id: "cycle-ww-2026-04",
    type: "workwear",
    label: "Arbeitskleidung",
    nextOrderDate: "2026-04-02T10:00:00.000Z",
    notes: "Monatliche Bündelung mit externer Lieferantenbestellung",
    scope: "Global, Standortzyklen vorbereitet",
  },
];

export const newsItems: NewsItem[] = [
  {
    id: "news-1",
    slug: "neue-serviceannahme-berlin-mitte",
    title: "Neue Serviceannahme in Berlin Mitte",
    teaser: "Ab dem 1. April wird die Kundenannahme im neuen Layout geführt.",
    content:
      "Die Serviceannahme in Berlin Mitte wird ab dem 1. April modernisiert. Bitte nutzt bis dahin die aktualisierten Prozesshinweise im Downloadbereich. Die Meldung ist als priorisierte Information für alle Standorte sichtbar. Die Einweisung für Serviceteams erfolgt am Vortag in zwei kompakten Time-Slots. Anhänge stehen im Intranet bereit und können lokal heruntergeladen werden.",
    priority: "hoch",
    publishedAt: "2026-03-20T08:00:00.000Z",
    status: "published",
    audience: ["global"],
    attachments: [
      { name: "Prozesshinweis.pdf", type: "pdf", url: "/demo/prozesshinweis.pdf" },
      { name: "Visualisierung.jpg", type: "image", url: "/demo/visualisierung.jpg" },
    ],
    author: "Markus Becker",
  },
  {
    id: "news-2",
    slug: "arbeitskleidung-fruehjahrsbestellung",
    title: "Frühjahrsbestellung Arbeitskleidung geöffnet",
    teaser: "Bestellungen für Poloshirts, Jacken und Sicherheitsschuhe sind jetzt möglich.",
    content:
      "Die Frühjahrsrunde für Arbeitskleidung ist geöffnet. Bitte reicht Bestellungen bis spätestens zum kommenden Bestelltermin ein. Größen- und Mengenprüfung erfolgt durch den Fachbereich vor der finalen Lieferantenbestellung. Für Nachfragen zu Größen und Passformen sind Muster an den Standorten Berlin Mitte und Hamburg Nord hinterlegt.",
    priority: "normal",
    publishedAt: "2026-03-18T09:00:00.000Z",
    status: "published",
    audience: ["global", "service"],
    attachments: [],
    author: "Markus Becker",
  },
  {
    id: "news-3",
    slug: "it-wartung-telefonie",
    title: "Geplante IT-Wartung Telefonie",
    teaser: "Kurzfristige Erreichbarkeit am Samstag eingeschränkt.",
    content:
      "Am Samstag von 07:00 bis 09:00 Uhr erfolgt eine Wartung der Telefonanlage. In dieser Zeit kann es zu temporären Einschränkungen kommen. Kritische Fälle bitte vorab an den IT-Bereitschaftsdienst melden. Die Meldung ist kritisch priorisiert und läuft automatisch am Folgetag aus.",
    priority: "kritisch",
    publishedAt: "2026-03-22T15:00:00.000Z",
    expiresAt: "2026-03-24T09:00:00.000Z",
    status: "published",
    audience: ["global"],
    attachments: [],
    author: "IT Bereitschaft",
  },
];

export const businessCardFields: BusinessCardFieldDefinition[] = [
  { key: "name", label: "Name", type: "text", required: true, active: true, sortOrder: 1, helpText: "Wird auf der Vorderseite ausgegeben." },
  { key: "position", label: "Position", type: "text", required: true, active: true, sortOrder: 2 },
  { key: "phone", label: "Telefonnummer", type: "phone", required: true, active: true, sortOrder: 3 },
  { key: "mobile", label: "Mobilnummer", type: "phone", required: false, active: true, sortOrder: 4 },
  { key: "email", label: "E-Mail", type: "email", required: false, active: true, sortOrder: 5, helpText: "Optional, da nicht alle Mitarbeitenden Firmen-E-Mail besitzen." },
  {
    key: "location",
    label: "Standort",
    type: "select",
    required: true,
    active: true,
    sortOrder: 6,
    options: ["Berlin Mitte", "Hamburg Nord", "Leipzig Zentrum"],
  },
  {
    key: "brandLogo",
    label: "Markenlogos",
    type: "select",
    required: true,
    active: true,
    sortOrder: 7,
    options: ["Audi", "Volkswagen", "Skoda"],
  },
  { key: "qrCode", label: "QR-Code", type: "checkbox", required: false, active: true, sortOrder: 8 },
];

export const businessCardOrders: BusinessCardOrder[] = [
  {
    id: "BC-2026-001",
    employee: "Anna Richter",
    employeeUsername: "service.mitte",
    status: "queued_for_bulk_order",
    createdAt: "2026-03-21T09:15:00.000Z",
    nextCycle: orderCycles[0].nextOrderDate,
    requestedQuantity: 200,
    submittedFields: [
      { key: "name", label: "Name", value: "Anna Richter" },
      { key: "position", label: "Position", value: "Serviceberaterin" },
      { key: "phone", label: "Telefonnummer", value: "+49 30 1234 567" },
      { key: "mobile", label: "Mobilnummer", value: "+49 171 1234567" },
      { key: "email", label: "E-Mail", value: "anna.richter@autohaus.local" },
      { key: "location", label: "Standort", value: "Berlin Mitte" },
      { key: "brandLogo", label: "Markenlogos", value: "Audi" },
      { key: "qrCode", label: "QR-Code", value: "Ja" },
    ],
    timeline: [
      { timestamp: "2026-03-21T09:15:00.000Z", title: "Bestellung eingereicht", detail: "Mitarbeiterin Anna Richter hat die Bestellung abgesendet.", actor: "Anna Richter" },
      { timestamp: "2026-03-21T10:02:00.000Z", title: "Freigabe erteilt", detail: "Admin Markus Becker hat die Bestellung genehmigt.", actor: "Markus Becker" },
      { timestamp: "2026-03-21T10:04:00.000Z", title: "Für Sammelbestellung vorgemerkt", detail: "Zuordnung zum Bestellzyklus März 2026.", actor: "System" },
    ],
    comments: [
      { id: "bcc-1", author: "Markus Becker", scope: "admin", message: "Telefonnummer auf dem finalen Druckstand geprüft.", createdAt: "2026-03-21T10:03:00.000Z" },
    ],
  },
  {
    id: "BC-2026-002",
    employee: "Timo Neumann",
    employeeUsername: "fachbereich",
    status: "submitted",
    createdAt: "2026-03-22T12:45:00.000Z",
    nextCycle: orderCycles[0].nextOrderDate,
    requestedQuantity: 100,
    reorderOf: "BC-2025-144",
    submittedFields: [
      { key: "name", label: "Name", value: "Timo Neumann" },
      { key: "position", label: "Position", value: "Fachbereichsleiter Service" },
      { key: "phone", label: "Telefonnummer", value: "+49 30 2222 111" },
      { key: "location", label: "Standort", value: "Berlin Mitte" },
      { key: "brandLogo", label: "Markenlogos", value: "Volkswagen" },
      { key: "qrCode", label: "QR-Code", value: "Nein" },
    ],
    timeline: [
      { timestamp: "2026-03-22T12:45:00.000Z", title: "Bestellung eingereicht", detail: "Nachbestellung auf Basis einer früheren Konfiguration.", actor: "Timo Neumann" },
    ],
    comments: [
      { id: "bcc-2", author: "Timo Neumann", scope: "employee", message: "Bitte wenn möglich das bestehende Layout unverändert übernehmen.", createdAt: "2026-03-22T12:46:00.000Z" },
    ],
  },
];

export const workwearCatalog: WorkwearCatalogItem[] = [
  { id: "WW-1", name: "Poloshirt Premium", category: "Poloshirts", description: "Robustes Poloshirt mit gesticktem Markenlogo.", sizes: ["S", "M", "L", "XL", "XXL"], active: true, variants: ["Herren", "Damen"] },
  { id: "WW-2", name: "Businesshemd Langarm", category: "Hemden", description: "Hemden für Beratung und Empfang mit regulärer Passform.", sizes: ["39", "40", "41", "42", "43", "44"], active: true },
  { id: "WW-3", name: "Softshelljacke", category: "Jacken", description: "Windabweisende Jacke für Außendienst und Serviceannahme.", sizes: ["S", "M", "L", "XL"], active: true },
  { id: "WW-4", name: "Werkstatthose", category: "Hosen", description: "Strapazierfähige Hose für Werkstatt und Fahrzeugaufbereitung.", sizes: ["46", "48", "50", "52", "54"], active: true },
  { id: "WW-5", name: "Sicherheitsschuh S3", category: "Sicherheitsschuhe", description: "S3-zertifizierter Schuh mit rutschhemmender Sohle.", sizes: ["39", "40", "41", "42", "43", "44", "45"], active: true },
];

export const workwearOrders: WorkwearOrder[] = [
  {
    id: "WW-2026-010",
    employee: "Sven Krüger",
    employeeUsername: "sven.krueger",
    status: "approved",
    createdAt: "2026-03-19T07:25:00.000Z",
    nextCycle: orderCycles[1].nextOrderDate,
    itemCount: 3,
    items: [
      { catalogItemId: "WW-1", itemName: "Poloshirt Premium", size: "L", quantity: 2 },
      { catalogItemId: "WW-5", itemName: "Sicherheitsschuh S3", size: "43", quantity: 1 },
    ],
    timeline: [
      { timestamp: "2026-03-19T07:25:00.000Z", title: "Bestellung eingereicht", detail: "Arbeitskleidung für Frühjahrszyklus angefragt.", actor: "Sven Krüger" },
      { timestamp: "2026-03-19T09:10:00.000Z", title: "Freigabe erteilt", detail: "Genehmigt durch Markus Becker.", actor: "Markus Becker" },
    ],
    comments: [
      { id: "wwc-1", author: "Markus Becker", scope: "admin", message: "Menge bestätigt, Schuhe werden mit der April-Lieferung gebündelt.", createdAt: "2026-03-19T09:11:00.000Z" },
    ],
  },
  {
    id: "WW-2026-011",
    employee: "Julia Sommer",
    employeeUsername: "julia.sommer",
    status: "submitted",
    createdAt: "2026-03-22T14:10:00.000Z",
    nextCycle: orderCycles[1].nextOrderDate,
    itemCount: 2,
    items: [
      { catalogItemId: "WW-3", itemName: "Softshelljacke", size: "M", quantity: 1 },
      { catalogItemId: "WW-1", itemName: "Poloshirt Premium", size: "M", quantity: 1 },
    ],
    timeline: [
      { timestamp: "2026-03-22T14:10:00.000Z", title: "Bestellung eingereicht", detail: "Neue Bestellung wartet auf Freigabe.", actor: "Julia Sommer" },
    ],
    comments: [
      { id: "wwc-2", author: "Julia Sommer", scope: "employee", message: "Falls möglich bitte Damen-Fit priorisieren.", createdAt: "2026-03-22T14:12:00.000Z" },
    ],
  },
];

export const approvalTasks: ApprovalTask[] = [
  {
    id: "approval-1",
    orderId: "BC-2026-002",
    orderType: "business_card",
    requester: "Timo Neumann",
    scope: "Berlin Mitte / Service",
    status: "submitted",
    createdAt: "2026-03-22T12:45:00.000Z",
    nextAction: "Prüfen und über Freigabe oder Ablehnung entscheiden",
  },
  {
    id: "approval-2",
    orderId: "WW-2026-011",
    orderType: "workwear",
    requester: "Julia Sommer",
    scope: "Hamburg Nord / Verkauf",
    status: "submitted",
    createdAt: "2026-03-22T14:10:00.000Z",
    nextAction: "Freigabe oder Ablehnung mit Kommentar dokumentieren",
  },
  {
    id: "approval-3",
    orderId: "BC-2026-001",
    orderType: "business_card",
    requester: "Anna Richter",
    scope: "Berlin Mitte / Service",
    status: "queued_for_bulk_order",
    createdAt: "2026-03-21T09:15:00.000Z",
    nextAction: "Externe Sammelbestellung separat bestätigen",
  },
];

export const users: UserSummary[] = [
  { username: "admin", displayName: "Markus Becker", role: "admin", scope: "Global", email: "admin@autohaus.local", location: "Berlin Mitte", department: "Verwaltung" },
  currentUser,
  { username: "fachbereich", displayName: "Timo Neumann", role: "fachbereichsadmin", scope: "Service / Kundendienst", email: "timo.neumann@autohaus.local", location: "Berlin Mitte", department: "Service", specialtyArea: "Kundendienst" },
  { username: "julia.sommer", displayName: "Julia Sommer", role: "mitarbeiter", scope: "Hamburg Nord / Verkauf", location: "Hamburg Nord", department: "Verkauf" },
];

export const roles: RoleSummary[] = [
  {
    key: "mitarbeiter",
    name: "Mitarbeiter",
    description: "Kann News lesen, eigene Bestellungen anlegen und den Verlauf einsehen.",
    permissions: ["news.read", "orders.create", "orders.own.read"],
    scopePrepared: false,
  },
  {
    key: "admin",
    name: "Admin",
    description: "Globaler Vollzugriff auf Inhalte, Stammdaten, Freigaben und Audit-Logs.",
    permissions: ["news.manage", "users.manage", "roles.manage", "orders.review", "audit.read"],
    scopePrepared: true,
  },
  {
    key: "fachbereichsadmin",
    name: "Fachbereichsadmin",
    description: "Scoped Adminrolle für konfigurierbare Fachbereiche ohne globale Vollrechte.",
    permissions: ["news.scope.manage", "orders.scope.review", "catalog.scope.manage"],
    scopePrepared: true,
  },
];

export const employeeDirectory: EmployeeDirectoryEntry[] = [
  {
    id: "emp-1",
    displayName: "Anna Richter",
    title: "Serviceberaterin",
    role: "mitarbeiter",
    location: "Berlin Mitte",
    department: "Service",
    specialtyArea: "Kundendienst",
    phone: "+49 30 1234 567",
    mobile: "+49 171 1234567",
    email: "anna.richter@autohaus.local",
    responsibilities: ["Serviceannahme", "Terminabstimmung"],
    presence: "vor Ort",
  },
  {
    id: "emp-2",
    displayName: "Timo Neumann",
    title: "Fachbereichsleiter Service",
    role: "fachbereichsadmin",
    location: "Berlin Mitte",
    department: "Service",
    specialtyArea: "Kundendienst",
    phone: "+49 30 2222 111",
    email: "timo.neumann@autohaus.local",
    responsibilities: ["Fachbereichsfreigaben", "Prozesspflege"],
    presence: "mobil",
  },
  {
    id: "emp-3",
    displayName: "Julia Sommer",
    title: "Verkaufsberaterin",
    role: "mitarbeiter",
    location: "Hamburg Nord",
    department: "Verkauf",
    phone: "+49 40 9876 100",
    email: "julia.sommer@autohaus.local",
    responsibilities: ["Probefahrten", "Fahrzeugübergaben"],
    presence: "vor Ort",
  },
  {
    id: "emp-4",
    displayName: "Markus Becker",
    title: "Intranet-Administrator",
    role: "admin",
    location: "Berlin Mitte",
    department: "Verwaltung",
    phone: "+49 30 7000 001",
    email: "admin@autohaus.local",
    responsibilities: ["Adminfreigaben", "Stammdatenpflege", "Audit"],
    presence: "vor Ort",
  },
];

export const documents: DocumentItem[] = [
  {
    id: "doc-1",
    title: "Checkliste Fahrzeugübergabe",
    category: "Service & Verkauf",
    audience: ["global", "Verkauf"],
    updatedAt: "2026-03-20T09:00:00.000Z",
    owner: "Markus Becker",
    fileType: "pdf",
    description: "Standardisierte Übergabecheckliste für Neu- und Gebrauchtfahrzeuge.",
  },
  {
    id: "doc-2",
    title: "CI-Vorlage E-Mail-Signatur",
    category: "Marketing & CI",
    audience: ["global"],
    updatedAt: "2026-03-19T08:30:00.000Z",
    owner: "Marketing",
    fileType: "docx",
    description: "Vorlage und Textbausteine für einheitliche interne und externe Signaturen.",
  },
  {
    id: "doc-3",
    title: "Werkstatt-Sicherheitsunterweisung",
    category: "Arbeitssicherheit",
    audience: ["Service", "Werkstatt"],
    updatedAt: "2026-03-15T12:00:00.000Z",
    owner: "HR",
    fileType: "pdf",
    description: "Pflichtdokument mit jährlicher Unterweisung und Nachweisprozess.",
  },
  {
    id: "doc-4",
    title: "Herstellerkampagne Q2",
    category: "Hersteller & Aktionen",
    audience: ["global", "Verkauf"],
    updatedAt: "2026-03-21T10:15:00.000Z",
    owner: "Vertriebsleitung",
    fileType: "link",
    description: "Aktuelle Aktionsseite mit Briefings, KPIs und Materialien für den Vertrieb.",
  },
];

export const calendarEvents: CalendarEvent[] = [
  {
    id: "cal-1",
    title: "Produktschulung Elektrofahrzeuge",
    category: "schulung",
    startsAt: "2026-03-25T08:30:00.000Z",
    endsAt: "2026-03-25T11:30:00.000Z",
    location: "Berlin Mitte",
    audience: ["Verkauf", "Service"],
    description: "Schulung zu Modellupdates, Förderlogik und Beratungsgesprächen.",
  },
  {
    id: "cal-2",
    title: "IT-Wartung Telefonie",
    category: "wartung",
    startsAt: "2026-03-23T07:00:00.000Z",
    endsAt: "2026-03-23T09:00:00.000Z",
    location: "Alle Standorte",
    audience: ["global"],
    description: "Kurzfristige Einschränkungen in der Erreichbarkeit möglich.",
  },
  {
    id: "cal-3",
    title: "Sammelbestellung Visitenkarten",
    category: "bestellung",
    startsAt: orderCycles[0].nextOrderDate,
    endsAt: orderCycles[0].nextOrderDate,
    location: "Digital",
    audience: ["global"],
    description: "Stichtag für die nächste Visitenkarten-Bündelung.",
  },
];

export const tickets: TicketSummary[] = [
  {
    id: "ticket-1",
    title: "Drucker im Servicebereich druckt doppelt",
    requester: "Anna Richter",
    category: "it",
    priority: "normal",
    status: "in_bearbeitung",
    createdAt: "2026-03-22T09:00:00.000Z",
    assignee: "IT Helpdesk",
  },
  {
    id: "ticket-2",
    title: "Neue Werbeaufsteller für Frühjahrsaktion",
    requester: "Julia Sommer",
    category: "marketing",
    priority: "hoch",
    status: "offen",
    createdAt: "2026-03-21T13:20:00.000Z",
    assignee: "Marketing",
  },
  {
    id: "ticket-3",
    title: "Arbeitsplatz für neuen Verkäufer vorbereiten",
    requester: "Timo Neumann",
    category: "facility",
    priority: "normal",
    status: "wartet_auf_rueckmeldung",
    createdAt: "2026-03-20T07:50:00.000Z",
    assignee: "Office Management",
  },
];

export const onboardingTemplates: OnboardingTemplate[] = [
  {
    id: "onb-1",
    name: "Onboarding Verkauf",
    targetRole: "Verkaufsberater/in",
    duration: "1. Woche",
    steps: [
      { id: "onb-1-1", title: "Benutzerkonto und Rollen zuweisen", owner: "Admin", required: true },
      { id: "onb-1-2", title: "Arbeitsplatz und Telefon einrichten", owner: "Office Management", required: true },
      { id: "onb-1-3", title: "Produktschulung und CI-Unterlagen bereitstellen", owner: "Vertriebsleitung", required: true },
    ],
  },
  {
    id: "onb-2",
    name: "Onboarding Service",
    targetRole: "Serviceberater/in",
    duration: "1. Woche",
    steps: [
      { id: "onb-2-1", title: "Serviceannahme-Prozesse einweisen", owner: "Fachbereich", required: true },
      { id: "onb-2-2", title: "Arbeitskleidung und Visitenkarten anstoßen", owner: "Admin", required: false },
      { id: "onb-2-3", title: "Sicherheitsunterweisung dokumentieren", owner: "HR", required: true },
    ],
  },
];

export const auditLogs: AuditLogItem[] = [
  {
    id: "audit-1",
    createdAt: "2026-03-22T08:00:00.000Z",
    actor: "admin",
    action: "news.publish",
    entityType: "news_post",
    entityId: "news-3",
    detail: "Kritische IT-Wartungsmeldung veröffentlicht",
  },
  {
    id: "audit-2",
    createdAt: "2026-03-21T10:02:00.000Z",
    actor: "admin",
    action: "order.approve",
    entityType: "order",
    entityId: "BC-2026-001",
    detail: "Visitenkartenbestellung freigegeben",
  },
  {
    id: "audit-3",
    createdAt: "2026-03-20T11:30:00.000Z",
    actor: "admin",
    action: "catalog.update",
    entityType: "workwear_catalog_item",
    entityId: "WW-5",
    detail: "Größenreihe für Sicherheitsschuhe aktualisiert",
  },
  {
    id: "audit-4",
    createdAt: "2026-03-20T08:10:00.000Z",
    actor: "admin",
    action: "order_cycle.update",
    entityType: "order_cycle",
    entityId: "cycle-bc-2026-03",
    detail: "Bestelltermin Visitenkarten auf Freitag 12:00 Uhr gesetzt",
  },
];
