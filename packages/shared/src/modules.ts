/**
 * Zentrale Modul-Registry.
 *
 * Diese Liste ist die einzige Quelle der Wahrheit für die Feature-Toggles:
 * - die API leitet daraus ihre `ModuleSetting`-Datensätze und den `ModuleEnabledGuard` ab,
 * - das Frontend baut daraus Navigation und Adminoberfläche.
 *
 * Neue Module werden ausschließlich hier eingetragen.
 */

export const MODULE_GROUPS = ["arbeitsplatz", "kommunikation", "prozesse", "ressourcen", "verwaltung"] as const;
export type ModuleGroup = (typeof MODULE_GROUPS)[number];

/**
 * Reifegrad eines Moduls.
 *
 * `beta` ist kein Etikett, sondern eine Einschränkung: Das Modul ist aus, und
 * einschalten darf es nur die Plattformverwaltung. Ein Haus soll sich unfertige
 * Software nicht selbst zuschalten können - und wer sie bekommt, muss es sehen.
 */
export const MODULE_STAGES = ["stabil", "beta"] as const;
export type ModuleStage = (typeof MODULE_STAGES)[number];

export interface ModuleDefinition {
  key: string;
  label: string;
  description: string;
  href: string;
  /** Lucide-Icon-Name, im Frontend auf die Komponente gemappt. */
  icon: string;
  group: ModuleGroup;
  /** Kernmodule lassen sich nicht abschalten, sonst wäre das Intranet unbedienbar. */
  core: boolean;
  /** Module, die aktiv sein müssen, damit dieses Modul aktiviert werden kann. */
  dependsOn: string[];
  /** Voreinstellung bei der Erstinstallation. */
  defaultEnabled: boolean;
  /** `beta` heißt: aus, und nur die Plattformverwaltung darf einschalten. */
  stage: ModuleStage;
}

export const MODULE_DEFINITIONS = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Persönliche Startseite mit Kennzahlen, News, Aufgaben und Terminen.",
    href: "/",
    icon: "LayoutDashboard",
    group: "arbeitsplatz",
    core: true,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "search",
    label: "Globale Suche",
    description: "Modulübergreifende Suche über News, Dokumente, Wiki, Mitarbeitende und Tickets.",
    href: "/suche",
    icon: "Search",
    group: "arbeitsplatz",
    core: false,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "notifications",
    label: "Benachrichtigungen",
    description: "Zentrale Benachrichtigungen zu Freigaben, Bestellungen, Tickets und News.",
    href: "/benachrichtigungen",
    icon: "Bell",
    group: "arbeitsplatz",
    core: true,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "quicklinks",
    label: "Schnellzugriffe",
    description: "Gepflegte Linksammlung auf Fachanwendungen wie DMS, Zeiterfassung oder Herstellerportale.",
    href: "/schnellzugriffe",
    icon: "Link2",
    group: "arbeitsplatz",
    core: false,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "news",
    label: "Aktuelles",
    description: "Interne News mit Zielgruppensteuerung, Priorität, Lesebestätigung und Kommentaren.",
    href: "/aktuelles",
    icon: "Newspaper",
    group: "kommunikation",
    core: false,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "directory",
    label: "Mitarbeiterverzeichnis",
    description: "Telefonbuch mit Standorten, Abteilungen, Zuständigkeiten und Anwesenheit.",
    href: "/mitarbeiter",
    icon: "Users",
    group: "kommunikation",
    core: false,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "polls",
    label: "Umfragen",
    description: "Kurzumfragen an die Belegschaft mit Auswertung in Echtzeit.",
    href: "/umfragen",
    icon: "BarChart3",
    group: "kommunikation",
    core: false,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "ideas",
    label: "Ideenmanagement",
    description: "Verbesserungsvorschläge einreichen, bewerten und den Bearbeitungsstand verfolgen.",
    href: "/ideen",
    icon: "Lightbulb",
    group: "kommunikation",
    core: false,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "documents",
    label: "Dokumente",
    description: "Dokumenten- und Vorlagenzentrale mit Kategorien und Zielgruppen.",
    href: "/dokumente",
    icon: "BookOpen",
    group: "prozesse",
    core: false,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "wiki",
    label: "Wissensdatenbank",
    description: "Interne Anleitungen und Prozessbeschreibungen als durchsuchbares Wiki.",
    href: "/wissen",
    icon: "Library",
    group: "prozesse",
    core: false,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "orders",
    label: "Bestellungen",
    description: "Visitenkarten- und Arbeitskleidungsbestellungen inklusive Sammelbestellterminen.",
    href: "/bestellungen/meine",
    icon: "ClipboardList",
    group: "prozesse",
    core: false,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "approvals",
    label: "Freigaben",
    description: "Einstufiger Freigabeprozess für Bestellungen inklusive externer Sammelbestellung.",
    href: "/freigaben",
    icon: "ShieldCheck",
    group: "prozesse",
    core: false,
    dependsOn: ["orders"],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "tickets",
    label: "Serviceanfragen",
    description: "Interne Tickets an IT, Facility, HR und Marketing mit Zuweisung und Verlauf.",
    href: "/tickets",
    icon: "LifeBuoy",
    group: "prozesse",
    core: false,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "onboarding",
    label: "Onboarding",
    description: "Rollenbasierte Einarbeitungspläne mit Checklisten und Fortschritt.",
    href: "/onboarding",
    icon: "GraduationCap",
    group: "prozesse",
    core: false,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "absences",
    label: "Abwesenheiten",
    description: "Urlaubs- und Abwesenheitsanträge mit Freigabe durch die Führungskraft.",
    href: "/abwesenheiten",
    icon: "CalendarOff",
    group: "prozesse",
    core: false,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "calendar",
    label: "Kalender",
    description: "Interne Termine, Schulungen, Aktionen und Wartungsfenster.",
    href: "/kalender",
    icon: "CalendarDays",
    group: "ressourcen",
    core: false,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "rooms",
    label: "Raumbuchung",
    description: "Besprechungsräume und Ressourcen standortübergreifend buchen.",
    href: "/raeume",
    icon: "DoorOpen",
    group: "ressourcen",
    core: false,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "admin",
    label: "Administration",
    description: "Benutzer, Rollen, Kataloge, Formulare, Bestelltermine und Modulsteuerung.",
    href: "/admin",
    icon: "Settings",
    group: "verwaltung",
    core: true,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
  {
    key: "audit",
    label: "Audit-Log",
    description: "Nachvollziehbare Protokollierung aller relevanten Aktionen.",
    href: "/admin/audit",
    icon: "ScrollText",
    group: "verwaltung",
    core: false,
    dependsOn: [],
    defaultEnabled: true,
    stage: "stabil",
  },
] as const satisfies readonly ModuleDefinition[];

export type ModuleKey = (typeof MODULE_DEFINITIONS)[number]["key"];

export const MODULE_KEYS = MODULE_DEFINITIONS.map((module) => module.key) as ModuleKey[];

const MODULE_BY_KEY = new Map<string, ModuleDefinition>(
  MODULE_DEFINITIONS.map((module) => [module.key, module as ModuleDefinition]),
);

export function getModule(key: string): ModuleDefinition | undefined {
  return MODULE_BY_KEY.get(key);
}

export function isModuleKey(key: string): key is ModuleKey {
  return MODULE_BY_KEY.has(key);
}

export const CORE_MODULE_KEYS = MODULE_DEFINITIONS.filter((module) => module.core).map(
  (module) => module.key,
) as ModuleKey[];

/** Module, die `key` als Abhängigkeit führen und beim Abschalten mit deaktiviert werden. */
export function getDependentModules(key: string): ModuleDefinition[] {
  return MODULE_DEFINITIONS.filter((module) => (module.dependsOn as readonly string[]).includes(key));
}

export const MODULE_GROUP_LABELS: Record<ModuleGroup, string> = {
  arbeitsplatz: "Arbeitsplatz",
  kommunikation: "Kommunikation",
  prozesse: "Prozesse",
  ressourcen: "Ressourcen",
  verwaltung: "Verwaltung",
};

/**
 * Dieselbe Liste, nur ohne die Verengung auf die heutigen Literalwerte.
 *
 * `as const` bindet jeden Reifegrad auf genau den Wert, der gerade dasteht –
 * solange kein Modul `beta` ist, hielte der Übersetzer jeden Vergleich damit
 * für einen Fehler. Diese Sicht macht die Abfragen unabhängig davon, was heute
 * zufällig in der Registry steht.
 */
const ALLE: readonly ModuleDefinition[] = MODULE_DEFINITIONS;

/** Module, die als Erprobung ausgeliefert werden. */
export function betaModules(): ModuleDefinition[] {
  return ALLE.filter((module) => module.stage === "beta");
}

export function isBeta(key: string): boolean {
  return ALLE.some((module) => module.key === key && module.stage === "beta");
}
