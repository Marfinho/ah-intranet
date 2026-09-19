import type { ModuleStage } from "./modules";

/** Gemeinsame Vertragstypen zwischen API und Frontend. */

/**
 * Schlüssel einer Rolle.
 *
 * Bewusst kein fester Aufzählungstyp: Rollen sind Daten des Hauses, nicht des
 * Codes. Die Grundausstattung steht in `ROLE_DEFINITIONS`, jedes Haus kann
 * eigene Rollen anlegen. Was der Code prüft, sind Rechte - nie Rollenschlüssel.
 */
export type AppRole = string;

/**
 * Zielgruppen werden als flache Tokens abgebildet: `global`, `location:<code>`,
 * `department:<code>` oder `specialty:<code>`. Das erlaubt eine einzige
 * Array-Überlappungsabfrage statt mehrerer Joins.
 */
export type AudienceScope = string;

export const GLOBAL_SCOPE: AudienceScope = "global";

export type OrderStatus =
  "draft" | "submitted" | "approved" | "rejected" | "queued_for_bulk_order" | "ordered" | "completed" | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "queued_for_bulk_order",
  "ordered",
  "completed",
  "cancelled",
];

export type NewsPriority = "niedrig" | "normal" | "hoch" | "kritisch";
export type NewsStatus = "draft" | "published" | "archived";
export type OrderType = "business_card" | "workwear";
export type CycleType = "business_cards" | "workwear";
export type TicketCategory = "it" | "facility" | "hr" | "marketing" | "fuhrpark";
export type TicketPriority = NewsPriority;
export type TicketStatus = "offen" | "in_bearbeitung" | "wartet_auf_rueckmeldung" | "geloest";
export type AbsenceType = "urlaub" | "krank" | "gleitzeit" | "sonderurlaub" | "fortbildung";
export type AbsenceStatus = "submitted" | "approved" | "rejected" | "cancelled";
export type IdeaStatus = "neu" | "in_pruefung" | "angenommen" | "umgesetzt" | "abgelehnt";
export type CalendarCategory = "schulung" | "aktion" | "wartung" | "meeting" | "bestellung";
export type Presence = "vor Ort" | "mobil" | "abwesend";
export type DocumentFileType = "pdf" | "docx" | "xlsx" | "link";

/* ------------------------------------------------------------------ Auth */

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  email?: string | null;
  role: AppRole;
  roles: AppRole[];
  /** Klartextnamen der Rollen, höchster Rang zuerst - Rollen sind Hausdaten. */
  roleLabels: string[];
  jobTitle?: string | null;
  location?: string | null;
  department?: string | null;
  specialtyArea?: string | null;
  scopeLabel: string;
  /** Zielgruppen-Tokens dieses Benutzers, für Sichtbarkeitsprüfungen. */
  scopes: AudienceScope[];
  permissions: string[];
  mustChangePassword: boolean;
  /** Autohaus, zu dem diese Sitzung gehört. */
  tenant: TenantRef;
  /** Darf Mandanten anlegen und abschalten - nicht identisch mit der Adminrolle im Haus. */
  isPlatformAdmin: boolean;
}

/** Kurzform eines Mandanten, wie sie in Sitzung und Kopfzeile erscheint. */
export interface TenantRef {
  slug: string;
  name: string;
}

/** Vollbild eines Mandanten für die Plattformverwaltung. */
export interface TenantSummary extends TenantRef {
  id: string;
  domain: string | null;
  isActive: boolean;
  notes: string | null;
  userCount: number;
  createdAt: string;
}

export interface LoginResponse {
  user: SessionUser;
}

/* --------------------------------------------------------------- Module */

export interface ModuleState {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: string;
  group: string;
  core: boolean;
  dependsOn: string[];
  enabled: boolean;
  /** `beta`: aus, und nur die Plattformverwaltung darf einschalten. */
  stage: ModuleStage;
  updatedAt?: string | null;
  updatedBy?: string | null;
  /** Abhängige Module, die beim Abschalten mitgehen. */
  blocks: string[];
}

/* -------------------------------------------------------------- Inhalte */

export interface NewsComment {
  id: string;
  author: string;
  message: string;
  createdAt: string;
}

export interface NewsItem {
  id: string;
  slug: string;
  title: string;
  teaser: string;
  content: string;
  priority: NewsPriority;
  status: NewsStatus;
  publishedAt?: string | null;
  expiresAt?: string | null;
  author: string;
  audienceScopes: AudienceScope[];
  attachments: { id: string; fileName: string; type: string; url: string }[];
  commentCount: number;
  comments?: NewsComment[];
  read: boolean;
  pinned: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  channel: "in_app" | "email";
  link?: string | null;
  createdAt: string;
  read: boolean;
}

export interface QuickLink {
  id: string;
  label: string;
  url: string;
  description?: string | null;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  audienceScopes: AudienceScope[];
}

export interface WikiArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  content?: string;
  tags: string[];
  author: string;
  updatedAt: string;
  isPublished: boolean;
}

/* ---------------------------------------------------------- Bestellungen */

export interface TimelineEntry {
  timestamp: string;
  title: string;
  detail: string;
  actor?: string | null;
}

export interface OrderComment {
  id: string;
  author: string;
  message: string;
  createdAt: string;
}

export interface BusinessCardFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: "text" | "email" | "phone" | "select" | "checkbox";
  required: boolean;
  active: boolean;
  sortOrder: number;
  options: string[];
  helpText?: string | null;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  employee: string;
  employeeUsername: string;
  scope: string;
  createdAt: string;
  submittedAt?: string | null;
  nextCycle?: string | null;
  itemCount: number;
  summary: string;
}

export interface BusinessCardOrderDetail extends OrderSummary {
  requestedQuantity: number;
  fields: { key: string; label: string; value: string }[];
  timeline: TimelineEntry[];
  comments: OrderComment[];
}

export interface WorkwearOrderItem {
  catalogItemId: string;
  itemName: string;
  size: string;
  quantity: number;
}

export interface WorkwearOrderDetail extends OrderSummary {
  items: WorkwearOrderItem[];
  timeline: TimelineEntry[];
  comments: OrderComment[];
}

export interface WorkwearCatalogItem {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  sizes: string[];
  active: boolean;
}

export interface OrderCycleInfo {
  id: string;
  type: CycleType;
  label: string;
  nextOrderDate: string;
  notes?: string | null;
  scope: string;
}

export interface ApprovalTask {
  id: string;
  orderId: string;
  orderNumber: string;
  orderType: OrderType;
  requester: string;
  scope: string;
  status: OrderStatus;
  createdAt: string;
  summary: string;
  nextAction: string;
}

/* ------------------------------------------------------------ Menschen */

export interface EmployeeDirectoryEntry {
  id: string;
  username: string;
  displayName: string;
  jobTitle: string;
  /** Klartextname der höchsten Rolle - zur Anzeige. */
  role: string;
  /** Schlüssel aller Rollen - für Auswahlfelder. */
  roleKeys: AppRole[];
  location?: string | null;
  department?: string | null;
  specialtyArea?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  responsibilities: string[];
  presence: Presence;
  status: UserAccountStatus;
}

/**
 * `deleted` steht für ein anonymisiertes Konto: es trägt keine Identität mehr,
 * bleibt aber als Anker aufbewahrungspflichtiger Vorgänge bestehen.
 */
export type UserAccountStatus = "active" | "inactive" | "deleted";

export interface RoleSummary {
  id: string;
  key: AppRole;
  name: string;
  description: string;
  /** Höherer Rang gewinnt, wenn eine Person mehrere Rollen hat. */
  rank: number;
  permissions: string[];
  userCount: number;
  /** Rollen der Grundausstattung lassen sich ändern, aber nicht löschen. */
  isSystem: boolean;
}

export interface PermissionSummary {
  id: string;
  key: string;
  name: string;
  description: string;
  /** Überschrift, unter der das Recht in der Auswahl steht. */
  bereich: string;
}

/* ------------------------------------------------------------ Prozesse */

export interface DocumentItem {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  fileType: DocumentFileType;
  url: string;
  owner: string;
  audienceScopes: AudienceScope[];
  updatedAt: string;
  isActive: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  category: CalendarCategory;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  description?: string | null;
  audienceScopes: AudienceScope[];
  organizer: string;
}

export interface TicketComment {
  id: string;
  author: string;
  message: string;
  createdAt: string;
}

export interface TicketSummary {
  id: string;
  number: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  requester: string;
  requesterUsername: string;
  assignee?: string | null;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  comments?: TicketComment[];
}

export interface OnboardingStep {
  id: string;
  title: string;
  ownerRole: string;
  required: boolean;
  sortOrder: number;
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  targetRole: string;
  durationLabel: string;
  steps: OnboardingStep[];
  assignmentCount: number;
}

export interface OnboardingAssignment {
  id: string;
  templateId: string;
  templateName: string;
  employee: string;
  employeeUsername: string;
  startDate: string;
  doneCount: number;
  totalCount: number;
  items: { id: string; title: string; ownerRole: string; required: boolean; done: boolean; doneAt?: string | null }[];
}

export interface Absence {
  id: string;
  employee: string;
  employeeUsername: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  workingDays: number;
  status: AbsenceStatus;
  note?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface AbsenceBalance {
  annualEntitlement: number;
  approved: number;
  pending: number;
  remaining: number;
}

/* ---------------------------------------------------------- Ressourcen */

export interface Room {
  id: string;
  name: string;
  location: string;
  capacity: number;
  equipment: string[];
  isActive: boolean;
}

export interface RoomBooking {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  organizer: string;
  organizerUsername: string;
  startsAt: string;
  endsAt: string;
}

/* ------------------------------------------------------- Beteiligung */

export interface Idea {
  id: string;
  title: string;
  description: string;
  category: string;
  status: IdeaStatus;
  author: string;
  authorUsername: string;
  createdAt: string;
  voteCount: number;
  votedByMe: boolean;
  decisionNote?: string | null;
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  description?: string | null;
  closesAt?: string | null;
  isActive: boolean;
  options: PollOption[];
  totalVotes: number;
  myOptionId?: string | null;
}

/* ------------------------------------------------------------- System */

export interface AuditLogItem {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
}

export interface DashboardMetric {
  label: string;
  value: string;
  helper: string;
  href?: string;
}

export interface DashboardPayload {
  metrics: DashboardMetric[];
  news: NewsItem[];
  notifications: NotificationItem[];
  approvals: ApprovalTask[];
  tickets: TicketSummary[];
  events: CalendarEvent[];
  cycles: OrderCycleInfo[];
  quickLinks: QuickLink[];
  absences: Absence[];
  polls: Poll[];
}

export interface SearchHit {
  module: string;
  moduleLabel: string;
  id: string;
  title: string;
  snippet: string;
  href: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
