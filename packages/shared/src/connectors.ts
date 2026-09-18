/**
 * Registry der Fremdsysteme, die ein Autohaus mit Konzernmarken typischerweise betreibt.
 *
 * Wichtig für die Bewertung jedes Eintrags ist `availability`. Im deutschen
 * Autohaus-Umfeld ist fast jede Herstellerschnittstelle vertraglich geschützt:
 * die Spezifikation bekommt nur, wer als Softwarepartner zertifiziert ist.
 * Diese Registry macht das explizit, statt Endpunkte zu erfinden, die es so
 * nicht gibt.
 */

export type ConnectorCategory = "hersteller" | "dms" | "teile" | "bewertung" | "boerse" | "buchhaltung";

export const CONNECTOR_CATEGORY_LABELS: Record<ConnectorCategory, string> = {
  hersteller: "Hersteller & Konzernsysteme",
  dms: "Dealer-Management-System",
  teile: "Teile & Technik",
  bewertung: "Bewertung & Kalkulation",
  boerse: "Fahrzeugbörsen",
  buchhaltung: "Buchhaltung",
};

/**
 * Wie zugänglich die Schnittstelle tatsächlich ist. Bestimmt, ob hier echter
 * Code laufen kann oder ob zuerst ein Vertrag nötig ist.
 */
export type ConnectorAvailability =
  /** Öffentlich dokumentierte API - vollständig implementiert. */
  | "public_api"
  /** Dateiformat öffentlich dokumentiert - vollständig implementiert. */
  | "documented_format"
  /** Spezifikation nur für zertifizierte Partner - hier bewusst nicht implementiert. */
  | "partner_contract"
  /** Kein Datenaustausch möglich oder vorgesehen; Anbindung über Portalaufruf. */
  | "portal_link";

export const AVAILABILITY_LABELS: Record<ConnectorAvailability, string> = {
  public_api: "Offene API – einsatzbereit",
  documented_format: "Dokumentiertes Format – einsatzbereit",
  partner_contract: "Partnervertrag erforderlich",
  portal_link: "Portalaufruf",
};

export const AVAILABILITY_HINTS: Record<ConnectorAvailability, string> = {
  public_api:
    "Die Schnittstelle ist öffentlich dokumentiert und in diesem Intranet vollständig umgesetzt. Es fehlen nur Ihre Zugangsdaten.",
  documented_format:
    "Das Austauschformat ist öffentlich dokumentiert und umgesetzt. Es fehlt nur die Angabe von Pfad bzw. Mandant.",
  partner_contract:
    "Der Hersteller bzw. Anbieter gibt die Spezifikation nur an zertifizierte Softwarepartner heraus. Ohne Vertrag und Testzugang lässt sich die Anbindung nicht seriös umsetzen – der Konnektor ist deshalb vorbereitet, aber bewusst ohne erfundene Endpunkte.",
  portal_link:
    "Dieses System bietet keinen Datenaustausch für Drittsoftware. Sinnvoll ist der direkte Absprung aus dem Intranet.",
};

export type ConnectorDirection = "inbound" | "outbound" | "bidirectional" | "none";

export interface ConnectorField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "number";
  required: boolean;
  /** Geheime Felder werden verschlüsselt abgelegt und nie zurückgeliefert. */
  secret: boolean;
  placeholder?: string;
  help?: string;
}

export interface ConnectorCapability {
  key: string;
  label: string;
  direction: Exclude<ConnectorDirection, "none" | "bidirectional">;
  description: string;
  /** Nur ausführbar, wenn der Adapter tatsächlich implementiert ist. */
  implemented: boolean;
}

export interface ConnectorDefinition {
  key: string;
  name: string;
  vendor: string;
  category: ConnectorCategory;
  availability: ConnectorAvailability;
  direction: ConnectorDirection;
  summary: string;
  /** Öffentliche Dokumentation, sofern vorhanden. */
  docsUrl?: string;
  /** Absprungziel für Portalkonnektoren. */
  portalUrl?: string;
  capabilities: ConnectorCapability[];
  fields: ConnectorField[];
  /** Was konkret nötig ist, um diesen Konnektor in Betrieb zu nehmen. */
  onboarding: string[];
}

export const CONNECTOR_DEFINITIONS = [
  /* ------------------------------------------- Hersteller / Konzern */
  {
    key: "vw_rwil",
    name: "RW.IL – Retail & Wholesale Integration Layer",
    vendor: "Volkswagen AG",
    category: "hersteller",
    availability: "partner_contract",
    direction: "bidirectional",
    summary:
      "Aktuelle Kommunikationsschicht des Volkswagen-Konzerns für den Aftersales-Austausch mit dem DMS. Löst den DMS-Backbone schrittweise ab; Aufträge laufen in die zentrale Auftragsdatenbank ORMA.",
    capabilities: [
      {
        key: "orders.push",
        label: "Werkstattaufträge übertragen",
        direction: "outbound",
        description: "Auftragsdaten an ORMA übergeben.",
        implemented: false,
      },
      {
        key: "orders.pull",
        label: "Auftragsrückmeldungen abholen",
        direction: "inbound",
        description: "Status und Rückmeldungen aus dem Konzernsystem lesen.",
        implemented: false,
      },
    ],
    fields: [
      {
        key: "partnerId",
        label: "Partnernummer (Betriebsnummer)",
        type: "text",
        required: true,
        secret: false,
        placeholder: "z. B. 12345",
      },
      { key: "endpoint", label: "Endpunkt aus der Partnerdokumentation", type: "url", required: true, secret: false },
      { key: "clientId", label: "Client-ID", type: "text", required: true, secret: false },
      { key: "clientSecret", label: "Client-Secret", type: "password", required: true, secret: true },
    ],
    onboarding: [
      "Anbindung läuft in der Praxis über den DMS-Anbieter, nicht direkt über das Autohaus.",
      "Zertifizierung als Softwarepartner bei der Volkswagen AG bzw. Beauftragung des DMS-Anbieters.",
      "Technische Spezifikation und Testumgebung werden erst nach Vertragsabschluss herausgegeben.",
    ],
  },
  {
    key: "vw_dms_backbone",
    name: "DMS-Backbone (Bestandsschnittstelle)",
    vendor: "Volkswagen AG",
    category: "hersteller",
    availability: "partner_contract",
    direction: "bidirectional",
    summary:
      "Jahrzehntelang der Kommunikationsstandard im Volkswagen-Konzern: Teilestammdaten über My ETKA Info, Arbeitswerte über APOS, Kundenaufträge. Wird durch RW.IL abgelöst, ist aber vielerorts noch produktiv.",
    capabilities: [
      {
        key: "parts.masterdata",
        label: "Teilestammdaten beziehen",
        direction: "inbound",
        description: "Preis- und Stammdatenaktualisierung für Teile.",
        implemented: false,
      },
      {
        key: "labor.values",
        label: "Arbeitswerte beziehen",
        direction: "inbound",
        description: "APOS-Arbeitswerte für die Kalkulation.",
        implemented: false,
      },
    ],
    fields: [
      { key: "partnerId", label: "Partnernummer", type: "text", required: true, secret: false },
      { key: "endpoint", label: "Endpunkt", type: "url", required: true, secret: false },
      { key: "certificate", label: "Client-Zertifikat (PEM)", type: "password", required: true, secret: true },
    ],
    onboarding: [
      "Zugang erhält nur, wer über den DMS-Anbieter angebunden ist.",
      "Spezifikation ist nicht öffentlich.",
      "Für Neuanbindungen empfiehlt der Konzern RW.IL statt des Backbones.",
    ],
  },
  {
    key: "vw_group_retail_portal",
    name: "Group Retail Portal",
    vendor: "Volkswagen AG",
    category: "hersteller",
    availability: "portal_link",
    direction: "none",
    summary:
      "Zentrales Händlerportal des Konzerns für Volkswagen, Audi, ŠKODA, SEAT/CUPRA und Nutzfahrzeuge. Zugang über persönliche Kennung der Mitarbeitenden.",
    portalUrl: "https://vwgroupsupply.com",
    capabilities: [],
    fields: [
      {
        key: "portalUrl",
        label: "Portaladresse",
        type: "url",
        required: true,
        secret: false,
        help: "Bei Bedarf auf die markenspezifische Adresse anpassen.",
      },
    ],
    onboarding: ["Kein Datenaustausch für Drittsysteme; die Anmeldung erfolgt personenbezogen im Portal."],
  },
  {
    key: "vw_elsa_pro",
    name: "ElsaPro",
    vendor: "Volkswagen AG",
    category: "teile",
    availability: "portal_link",
    direction: "none",
    summary:
      "Reparaturleitfäden, Stromlaufpläne, Wartungstabellen und technische Aktionen. Arbeitsmittel der Werkstatt, kein Drittsystem-Datenaustausch.",
    capabilities: [],
    fields: [{ key: "portalUrl", label: "ElsaPro-Adresse", type: "url", required: true, secret: false }],
    onboarding: ["Absprung mit Fahrgestellnummer, sofern die interne Adresse das unterstützt."],
  },
  {
    key: "vw_etka",
    name: "ETKA / My ETKA Info",
    vendor: "Volkswagen AG",
    category: "teile",
    availability: "portal_link",
    direction: "none",
    summary:
      "Elektronischer Teilekatalog des Konzerns für Volkswagen, Audi, ŠKODA, SEAT und CUPRA. Teilestammdaten fließen produktiv über den DMS-Backbone ins DMS, nicht in Drittsysteme.",
    capabilities: [],
    fields: [{ key: "portalUrl", label: "ETKA-Adresse", type: "url", required: true, secret: false }],
    onboarding: ["Teiledatenversorgung läuft über das DMS; hier nur der Absprung für Mitarbeitende."],
  },
  {
    key: "vw_odis",
    name: "ODIS – Offboard Diagnostic Information System",
    vendor: "Volkswagen AG",
    category: "teile",
    availability: "portal_link",
    direction: "none",
    summary:
      "Diagnose, Steuergeräte-Codierung und Programmierung. Läuft an gebundenen Werkstattarbeitsplätzen, nicht als Serverdienst.",
    capabilities: [],
    fields: [
      { key: "portalUrl", label: "Diagnose-Portal / Startadresse", type: "url", required: false, secret: false },
    ],
    onboarding: ["Arbeitsplatzgebundene Software ohne Serverschnittstelle für ein Intranet."],
  },

  /* -------------------------------------------------------------- DMS */
  {
    key: "dms_vaudis",
    name: "VaudisX / VaudisClassic",
    vendor: "T-Systems",
    category: "dms",
    availability: "partner_contract",
    direction: "bidirectional",
    summary:
      "Auf Konzernmarken spezialisiertes DMS und im Volkswagen-Umfeld am weitesten verbreitet. VaudisX ist der Nachfolger und erhält die RW.IL-Anbindung.",
    capabilities: [
      {
        key: "customers.pull",
        label: "Kunden und Fahrzeuge lesen",
        direction: "inbound",
        description: "Stammdaten für Verzeichnis und Auftragsbezug.",
        implemented: false,
      },
      {
        key: "orders.pull",
        label: "Werkstattaufträge lesen",
        direction: "inbound",
        description: "Auftragsstatus für die Werkstattübersicht.",
        implemented: false,
      },
    ],
    fields: [
      { key: "endpoint", label: "Endpunkt", type: "url", required: true, secret: false },
      { key: "tenant", label: "Mandant / Betriebsnummer", type: "text", required: true, secret: false },
      { key: "username", label: "Technischer Benutzer", type: "text", required: true, secret: false },
      { key: "password", label: "Passwort", type: "password", required: true, secret: true },
    ],
    onboarding: [
      "Schnittstellenfreigabe beim DMS-Anbieter beantragen (kostenpflichtig, mit Vertrag).",
      "Ohne Spezifikation und Testmandant ist keine belastbare Umsetzung möglich.",
      "Als Übergangslösung funktioniert der Dateiaustausch-Konnektor.",
    ],
  },
  {
    key: "dms_file_exchange",
    name: "DMS-Dateiaustausch (CSV)",
    vendor: "herstellerunabhängig",
    category: "dms",
    availability: "documented_format",
    direction: "inbound",
    summary:
      "Pragmatischer Weg, der mit praktisch jedem DMS funktioniert: das DMS legt einen Bestandsexport als CSV in ein Verzeichnis, das Intranet liest ihn ein. Ohne Vertrag, ohne Zertifizierung.",
    capabilities: [
      {
        key: "vehicles.import",
        label: "Fahrzeugbestand einlesen",
        direction: "inbound",
        description: "CSV-Export des DMS in den internen Fahrzeugbestand übernehmen.",
        implemented: true,
      },
    ],
    fields: [
      {
        key: "directory",
        label: "Austauschverzeichnis",
        type: "text",
        required: true,
        secret: false,
        placeholder: "/var/dms-export",
        help: "Verzeichnis, in das das DMS seinen Export schreibt. Muss für die API lesbar sein.",
      },
      {
        key: "filePattern",
        label: "Dateiname",
        type: "text",
        required: false,
        secret: false,
        placeholder: "bestand*.csv",
        help: "Bei mehreren Treffern wird die zuletzt geänderte Datei verwendet.",
      },
      {
        key: "delimiter",
        label: "Trennzeichen",
        type: "text",
        required: false,
        secret: false,
        placeholder: ";",
        help: "Standard ist das im deutschen Umfeld übliche Semikolon.",
      },
      {
        key: "encoding",
        label: "Zeichensatz",
        type: "text",
        required: false,
        secret: false,
        placeholder: "latin1",
        help: "latin1 oder utf8. Viele DMS exportieren weiterhin latin1.",
      },
    ],
    onboarding: [
      "Im DMS einen wiederkehrenden Bestandsexport einrichten.",
      "Exportverzeichnis für die API freigeben (Netzlaufwerk oder Container-Volume).",
      "Spaltennamen werden flexibel erkannt; erwartet werden u. a. VIN, Marke, Modell, Preis, Kilometerstand.",
    ],
  },

  /* --------------------------------------------------------- Börsen */
  {
    key: "mobile_de",
    name: "mobile.de Seller-API",
    vendor: "mobile.de GmbH",
    category: "boerse",
    availability: "public_api",
    direction: "bidirectional",
    summary:
      "Öffentlich dokumentierte REST-API zur Verwaltung der Inserate eines Händlers. Einzige Schnittstelle in dieser Übersicht, deren Spezifikation frei zugänglich ist – entsprechend vollständig umgesetzt.",
    docsUrl: "https://services.mobile.de/docs/seller-api.html",
    capabilities: [
      {
        key: "vehicles.pull",
        label: "Inserate in den Bestand übernehmen",
        direction: "inbound",
        description: "Alle Inserate des Händlerkontos lesen und im Intranet als Fahrzeugbestand führen.",
        implemented: true,
      },
    ],
    fields: [
      {
        key: "baseUrl",
        label: "Basisadresse",
        type: "url",
        required: false,
        secret: false,
        placeholder: "https://services.mobile.de",
        help: "Für Tests: https://services.sandbox.mobile.de",
      },
      {
        key: "sellerId",
        label: "mobile.de Händler-ID",
        type: "text",
        required: true,
        secret: false,
        placeholder: "z. B. 12345",
      },
      { key: "username", label: "API-Benutzer", type: "text", required: true, secret: false },
      { key: "password", label: "API-Passwort", type: "password", required: true, secret: true },
    ],
    onboarding: [
      "API-Zugang über den mobile.de Händlerbetreuer anfordern.",
      "Zugangsdaten sind vom Händlerkonto getrennt und gelten je API-Benutzer.",
      "Vor dem Produktivbetrieb gegen die Sandbox testen.",
    ],
  },
  {
    key: "autoscout24",
    name: "AutoScout24 Händler-API",
    vendor: "AutoScout24 GmbH",
    category: "boerse",
    availability: "partner_contract",
    direction: "bidirectional",
    summary:
      "Zweite große Fahrzeugbörse im deutschsprachigen Raum. Die Schnittstelle wird an angebundene Softwarehäuser vergeben, die Dokumentation ist nicht frei abrufbar.",
    capabilities: [
      {
        key: "vehicles.pull",
        label: "Inserate übernehmen",
        direction: "inbound",
        description: "Bestand aus dem Händlerkonto lesen.",
        implemented: false,
      },
    ],
    fields: [
      { key: "endpoint", label: "Endpunkt", type: "url", required: true, secret: false },
      { key: "customerId", label: "Kundennummer", type: "text", required: true, secret: false },
      { key: "apiKey", label: "API-Schlüssel", type: "password", required: true, secret: true },
    ],
    onboarding: [
      "Schnittstellenpartnerschaft bei AutoScout24 beantragen.",
      "Dokumentation und Testzugang folgen nach Freigabe.",
    ],
  },

  /* ---------------------------------------------- Bewertung / Teile */
  {
    key: "dat_silverdat",
    name: "DAT SilverDAT",
    vendor: "Deutsche Automobil Treuhand",
    category: "bewertung",
    availability: "partner_contract",
    direction: "bidirectional",
    summary:
      "Branchenstandard für Fahrzeugbewertung, Reparaturkalkulation und VIN-Abfrage. Die DAT arbeitet mit rund 400 Schnittstellenpartnern; die Beschreibung erhält nur, wer eine Schnittstellenpartnerschaft abschließt.",
    docsUrl: "https://www.dat.de/schnittstellen/",
    capabilities: [
      {
        key: "valuation.request",
        label: "Fahrzeugbewertung abrufen",
        direction: "outbound",
        description: "Händler-Einkaufs- und Verkaufswerte ermitteln.",
        implemented: false,
      },
      {
        key: "vin.decode",
        label: "VIN auflösen",
        direction: "outbound",
        description: "Fahrzeugidentifikation über die Fahrgestellnummer.",
        implemented: false,
      },
    ],
    fields: [
      { key: "customerNumber", label: "DAT-Kundennummer", type: "text", required: true, secret: false },
      { key: "username", label: "Benutzer", type: "text", required: true, secret: false },
      { key: "password", label: "Passwort", type: "password", required: true, secret: true },
    ],
    onboarding: [
      "Schnittstellenpartnerschaft über das Formular der DAT beantragen.",
      "Schnittstellenbeschreibung wird an Softwarehäuser nach Vertragsabschluss ausgegeben.",
    ],
  },
  {
    key: "schwacke",
    name: "SchwackeNet",
    vendor: "Schwacke / Autovista",
    category: "bewertung",
    availability: "partner_contract",
    direction: "outbound",
    summary: "Alternative Bewertungsdatenbank für Gebrauchtfahrzeuge, lizenz- und vertragsgebunden.",
    capabilities: [
      {
        key: "valuation.request",
        label: "Bewertung abrufen",
        direction: "outbound",
        description: "Restwerte und Marktpreise ermitteln.",
        implemented: false,
      },
    ],
    fields: [
      { key: "customerNumber", label: "Kundennummer", type: "text", required: true, secret: false },
      { key: "apiKey", label: "API-Schlüssel", type: "password", required: true, secret: true },
    ],
    onboarding: ["Lizenzvertrag erforderlich; Spezifikation nicht öffentlich."],
  },
  {
    key: "tecdoc",
    name: "TecDoc",
    vendor: "TecAlliance",
    category: "teile",
    availability: "partner_contract",
    direction: "outbound",
    summary:
      "Herstellerübergreifender Teilekatalog für den freien Teilebezug. Relevant, sobald neben Originalteilen auch Identteile verbaut werden.",
    capabilities: [
      {
        key: "parts.lookup",
        label: "Teile suchen",
        direction: "outbound",
        description: "Teilesuche über Fahrzeug oder Nummer.",
        implemented: false,
      },
    ],
    fields: [
      { key: "providerId", label: "Provider-ID", type: "text", required: true, secret: false },
      { key: "apiKey", label: "API-Schlüssel", type: "password", required: true, secret: true },
    ],
    onboarding: ["Lizenz bei TecAlliance erforderlich."],
  },

  /* -------------------------------------------------------- Buchhaltung */
  {
    key: "datev",
    name: "DATEV-Buchungsstapel",
    vendor: "DATEV eG",
    category: "buchhaltung",
    availability: "documented_format",
    direction: "outbound",
    summary:
      "Das EXTF-Buchungsstapelformat ist öffentlich dokumentiert und der übliche Weg zur Steuerkanzlei. Umgesetzt als Export, der sich in DATEV einlesen lässt – ohne Vertrag mit der DATEV.",
    capabilities: [
      {
        key: "bookings.export",
        label: "Buchungsstapel erzeugen",
        direction: "outbound",
        description: "Abgeschlossene Vorgänge als EXTF-CSV für den Import in DATEV ausgeben.",
        implemented: true,
      },
    ],
    fields: [
      {
        key: "consultantNumber",
        label: "Beraternummer",
        type: "number",
        required: true,
        secret: false,
        placeholder: "1234567",
      },
      {
        key: "clientNumber",
        label: "Mandantennummer",
        type: "number",
        required: true,
        secret: false,
        placeholder: "12345",
      },
      {
        key: "accountLength",
        label: "Sachkontenlänge",
        type: "number",
        required: false,
        secret: false,
        placeholder: "4",
      },
      {
        key: "fiscalStart",
        label: "Beginn Wirtschaftsjahr",
        type: "text",
        required: false,
        secret: false,
        placeholder: "0101",
        help: "TTMM, Standard 0101.",
      },
      {
        key: "expenseAccountBusinessCards",
        label: "Aufwandskonto Visitenkarten",
        type: "number",
        required: true,
        secret: false,
        placeholder: "6600",
        help: "Sachkonto, auf das Visitenkartenbestellungen gebucht werden (z. B. Werbekosten).",
      },
      {
        key: "expenseAccountWorkwear",
        label: "Aufwandskonto Arbeitskleidung",
        type: "number",
        required: true,
        secret: false,
        placeholder: "6110",
      },
      {
        key: "counterAccount",
        label: "Gegenkonto",
        type: "number",
        required: true,
        secret: false,
        placeholder: "1600",
        help: "Kreditoren- oder Verrechnungskonto für die Gegenbuchung.",
      },
      {
        key: "buKey",
        label: "BU-Schlüssel",
        type: "text",
        required: false,
        secret: false,
        placeholder: "9",
        help: "Steuerschlüssel, mit der Kanzlei abzustimmen. Leer lassen, wenn ohne Automatik gebucht wird.",
      },
      {
        key: "exportDirectory",
        label: "Ablageverzeichnis",
        type: "text",
        required: false,
        secret: false,
        placeholder: "/var/datev-export",
        help: "Wohin der Stapel geschrieben wird. Leer lassen, um ihn nur zum Download zu erzeugen.",
      },
    ],
    onboarding: [
      "Beraternummer und Mandantennummer bei der Steuerkanzlei erfragen.",
      "Konten und BU-Schlüssel mit der Kanzlei abstimmen – die Steuerautomatik hängt vom Kontenrahmen ab.",
      "Die erzeugte Datei wird in DATEV über den Buchungsstapel-Import eingelesen.",
    ],
  },
] as const satisfies readonly ConnectorDefinition[];

export type ConnectorKey = (typeof CONNECTOR_DEFINITIONS)[number]["key"];

export const CONNECTOR_KEYS = CONNECTOR_DEFINITIONS.map((entry) => entry.key) as ConnectorKey[];

const CONNECTOR_BY_KEY = new Map<string, ConnectorDefinition>(
  CONNECTOR_DEFINITIONS.map((entry) => [entry.key, entry as ConnectorDefinition]),
);

export function getConnector(key: string): ConnectorDefinition | undefined {
  return CONNECTOR_BY_KEY.get(key);
}

export function isConnectorKey(key: string): key is ConnectorKey {
  return CONNECTOR_BY_KEY.has(key);
}

/** Konnektoren, für die tatsächlich Code läuft. */
export function isRunnable(definition: ConnectorDefinition): boolean {
  return definition.capabilities.some((capability) => capability.implemented);
}

export function getCapability(connectorKey: string, capabilityKey: string): ConnectorCapability | undefined {
  return getConnector(connectorKey)?.capabilities.find((entry) => entry.key === capabilityKey);
}

/* ------------------------------------------------ Laufzeit-Zustand */

export type ConnectorStatus = "not_configured" | "configured" | "disabled";
export type SyncRunStatus = "running" | "succeeded" | "failed";

export interface ConnectorState {
  key: string;
  name: string;
  vendor: string;
  category: ConnectorCategory;
  availability: ConnectorAvailability;
  direction: ConnectorDirection;
  summary: string;
  docsUrl?: string;
  portalUrl?: string;
  capabilities: ConnectorCapability[];
  fields: ConnectorField[];
  onboarding: string[];
  status: ConnectorStatus;
  runnable: boolean;
  /** Nicht-geheime Konfiguration; Geheimnisse werden nie ausgeliefert. */
  settings: Record<string, string>;
  /** Welche geheimen Felder hinterlegt sind - ohne die Werte selbst. */
  secretsSet: string[];
  lastCheckAt?: string | null;
  lastCheckOk?: boolean | null;
  lastCheckMessage?: string | null;
  updatedBy?: string | null;
  lastRun?: SyncRunSummary | null;
}

export interface SyncRunSummary {
  id: string;
  connectorKey: string;
  connectorName: string;
  capability: string;
  status: SyncRunStatus;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  itemsProcessed: number;
  itemsFailed: number;
  message?: string | null;
  triggeredBy?: string | null;
}

export interface VehicleListing {
  id: string;
  source: string;
  sourceName: string;
  externalId: string;
  vin?: string | null;
  make: string;
  model: string;
  title: string;
  price?: number | null;
  currency: string;
  mileageKm?: number | null;
  firstRegistration?: string | null;
  fuel?: string | null;
  gearbox?: string | null;
  powerKw?: number | null;
  url?: string | null;
  imageUrl?: string | null;
  syncedAt: string;
}
