export type AppRole = "mitarbeiter" | "admin" | "fachbereichsadmin";

export type OrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "queued_for_bulk_order"
  | "ordered"
  | "completed"
  | "cancelled";

export type NewsPriority = "niedrig" | "normal" | "hoch" | "kritisch";
export type NewsStatus = "draft" | "published" | "archived";
export type OrderType = "business_card" | "workwear";
export type CycleType = "business_cards" | "workwear";

export interface DashboardMetric {
  label: string;
  value: string;
  helper: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  channel: "in_app" | "email";
  createdAt: string;
  read: boolean;
  link?: string;
}

export interface NewsAttachment {
  name: string;
  type: "image" | "pdf" | "file";
  url: string;
}

export interface NewsItem {
  id: string;
  slug: string;
  title: string;
  teaser: string;
  content: string;
  priority: NewsPriority;
  publishedAt: string;
  expiresAt?: string;
  status: NewsStatus;
  audience: string[];
  attachments: NewsAttachment[];
  author: string;
}

export interface OrderCycleInfo {
  id: string;
  type: CycleType;
  label: string;
  nextOrderDate: string;
  notes: string;
  scope: string;
}

export interface TimelineEntry {
  timestamp: string;
  title: string;
  detail: string;
  actor?: string;
}

export interface OrderComment {
  id: string;
  author: string;
  scope: "employee" | "admin" | "internal";
  message: string;
  createdAt: string;
}

export interface BusinessCardFieldDefinition {
  key: string;
  label: string;
  type: "text" | "email" | "phone" | "select" | "checkbox";
  required: boolean;
  active: boolean;
  sortOrder: number;
  options?: string[];
  helpText?: string;
}

export interface BusinessCardOrder {
  id: string;
  employee: string;
  employeeUsername: string;
  status: OrderStatus;
  createdAt: string;
  nextCycle: string;
  requestedQuantity: number;
  reorderOf?: string;
  submittedFields: { key: string; label: string; value: string }[];
  timeline: TimelineEntry[];
  comments: OrderComment[];
}

export interface WorkwearCatalogItem {
  id: string;
  name: string;
  category: string;
  description: string;
  sizes: string[];
  active: boolean;
  variants?: string[];
}

export interface WorkwearOrderItem {
  catalogItemId: string;
  itemName: string;
  size: string;
  quantity: number;
}

export interface WorkwearOrder {
  id: string;
  employee: string;
  employeeUsername: string;
  status: OrderStatus;
  createdAt: string;
  nextCycle: string;
  itemCount: number;
  items: WorkwearOrderItem[];
  timeline: TimelineEntry[];
  comments: OrderComment[];
}

export interface ApprovalTask {
  id: string;
  orderId: string;
  orderType: OrderType;
  requester: string;
  scope: string;
  status: OrderStatus;
  createdAt: string;
  nextAction: string;
}

export interface AuditLogItem {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
}

export interface UserSummary {
  username: string;
  displayName: string;
  role: AppRole;
  scope: string;
  email?: string;
  location?: string;
  department?: string;
  specialtyArea?: string;
}

export interface RoleSummary {
  key: AppRole;
  name: string;
  description: string;
  permissions: string[];
  scopePrepared: boolean;
}

export interface EmployeeDirectoryEntry {
  id: string;
  displayName: string;
  title: string;
  role: AppRole;
  location: string;
  department: string;
  specialtyArea?: string;
  phone: string;
  mobile?: string;
  email?: string;
  responsibilities: string[];
  presence: "vor Ort" | "mobil" | "abwesend";
}

export interface DocumentItem {
  id: string;
  title: string;
  category: string;
  audience: string[];
  updatedAt: string;
  owner: string;
  fileType: "pdf" | "docx" | "xlsx" | "link";
  description: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  category: "schulung" | "aktion" | "wartung" | "meeting" | "bestellung";
  startsAt: string;
  endsAt: string;
  location: string;
  audience: string[];
  description: string;
}

export interface TicketSummary {
  id: string;
  title: string;
  requester: string;
  category: "it" | "facility" | "hr" | "marketing";
  priority: "niedrig" | "normal" | "hoch" | "kritisch";
  status: "offen" | "in_bearbeitung" | "wartet_auf_rueckmeldung" | "geloest";
  createdAt: string;
  assignee: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  owner: string;
  required: boolean;
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  targetRole: string;
  duration: string;
  steps: OnboardingStep[];
}
