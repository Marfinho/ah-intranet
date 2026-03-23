import {
  approvalTasks,
  auditLogs,
  businessCardOrders,
  calendarEvents,
  currentUser,
  documents,
  employeeDirectory,
  newsItems,
  notifications,
  onboardingTemplates,
  orderCycles,
  roles,
  tickets,
  users,
  workwearCatalog,
  workwearOrders,
} from "./demo-data";

export const allOrders = [...businessCardOrders, ...workwearOrders].sort((a, b) =>
  a.createdAt < b.createdAt ? 1 : -1,
);

export const pendingApprovals = approvalTasks.filter((task) =>
  ["submitted", "approved", "queued_for_bulk_order"].includes(task.status),
);

export const criticalNews = newsItems.filter((item) => item.priority === "kritisch" || item.priority === "hoch");
export const unreadNotifications = notifications.filter((item) => !item.read);
export const openTickets = tickets.filter((ticket) => ticket.status !== "geloest");
export const documentCategories = [...new Set(documents.map((item) => item.category))].sort();

export const orderStatusOptions = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "queued_for_bulk_order",
  "ordered",
  "completed",
  "cancelled",
] as const;

export const adminSnapshot = {
  notifications,
  auditLogs,
  users,
  roles,
  orderCycles,
  workwearCatalog,
  approvalTasks,
  employeeDirectory,
  documents,
  tickets,
  onboardingTemplates,
};

export const appSnapshot = {
  currentUser,
  newsItems,
  orderCycles,
  businessCardOrders,
  workwearOrders,
  notifications,
  approvalTasks,
  employeeDirectory,
  documents,
  calendarEvents,
  tickets,
  onboardingTemplates,
};
