import { Injectable } from "@nestjs/common";
import type { AuditLogItem, DashboardMetric, DashboardPayload, SearchHit } from "@ah-intranet/shared";
import { getModule } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { ModuleRegistryService } from "../../core/module-registry.service";
import { NotificationsService } from "../../core/notifications.service";
import { audienceFilter, displayName } from "../../core/mappers";
import { isManaging, type RequestUser } from "../../core/request-user";
import { NewsService } from "../content/news.service";
import { QuickLinksService } from "../content/quicklinks.service";
import { OrdersService } from "../orders/orders.service";
import { ServiceDeskService } from "../servicedesk/servicedesk.service";
import { ResourcesService } from "../resources/resources.service";
import { AbsencesService } from "../people/absences.service";

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modules: ModuleRegistryService,
    private readonly notifications: NotificationsService,
    private readonly news: NewsService,
    private readonly quickLinks: QuickLinksService,
    private readonly orders: OrdersService,
    private readonly desk: ServiceDeskService,
    private readonly resources: ResourcesService,
    private readonly absences: AbsencesService,
  ) {}

  /**
   * Alles, was die Startseite braucht, in einem Aufruf. Deaktivierte Module
   * liefern leere Listen, statt Abfragen abzusetzen - das spart je abgeschaltetem
   * Modul einen Roundtrip.
   */
  async dashboard(user: RequestUser): Promise<DashboardPayload> {
    const enabled = await this.modules.enabledKeys();
    const on = (key: string) => enabled.has(key);
    const managing = isManaging(user);

    const [news, notifications, approvals, tickets, events, cycles, quickLinks, absences, polls] = await Promise.all([
      on("news") ? this.news.list(user, { take: 5 }) : Promise.resolve([]),
      this.notifications.list(user, true),
      on("approvals") && managing ? this.orders.approvals(user) : Promise.resolve([]),
      on("tickets") ? this.desk.tickets(user, { scope: "mine" }).then((result) => result.items.slice(0, 5)) : Promise.resolve([]),
      on("calendar") ? this.resources.events(user).then((items) => items.slice(0, 5)) : Promise.resolve([]),
      on("orders") ? this.orders.cycles() : Promise.resolve([]),
      on("quicklinks") ? this.quickLinks.list(user) : Promise.resolve([]),
      on("absences") ? this.absences.list(user, { scope: "mine" }).then((result) => result.items.slice(0, 5)) : Promise.resolve([]),
      on("polls") ? this.desk.polls(user).then((result) => result.items.slice(0, 2)) : Promise.resolve([]),
    ]);

    return {
      metrics: await this.metrics(user, enabled),
      news,
      notifications: notifications.slice(0, 6),
      approvals: approvals.slice(0, 5),
      tickets,
      events,
      cycles,
      quickLinks,
      absences,
      polls,
    };
  }

  private async metrics(user: RequestUser, enabled: Set<string>): Promise<DashboardMetric[]> {
    const managing = isManaging(user);
    const metrics: DashboardMetric[] = [];

    // Alle Zählungen parallel; jede ist ein reiner COUNT über einen Index.
    const [unreadNews, myOrders, openApprovals, myTickets, openAbsences, unreadNotifications] = await Promise.all([
      enabled.has("news")
        ? this.prisma.newsPost.count({
            where: {
              status: "published",
              publishedAt: { lte: new Date() },
              reads: { none: { userId: user.id } },
              ...audienceFilter(user),
            },
          })
        : 0,
      enabled.has("orders")
        ? this.prisma.order.count({
            where: { requesterId: user.id, status: { in: ["submitted", "approved", "queued_for_bulk_order", "ordered"] } },
          })
        : 0,
      enabled.has("approvals") && managing
        ? this.prisma.order.count({ where: { status: "submitted" } })
        : 0,
      enabled.has("tickets")
        ? this.prisma.ticket.count({
            where: { OR: [{ requesterId: user.id }, { assigneeId: user.id }], status: { not: "geloest" } },
          })
        : 0,
      enabled.has("absences") ? this.prisma.absence.count({ where: { userId: user.id, status: "submitted" } }) : 0,
      this.notifications.unreadCount(user),
    ]);

    if (enabled.has("news")) {
      metrics.push({ label: "Ungelesene News", value: String(unreadNews), helper: "für Ihre Zielgruppe", href: "/aktuelles" });
    }
    metrics.push({
      label: "Benachrichtigungen",
      value: String(unreadNotifications),
      helper: "ungelesen",
      href: "/benachrichtigungen",
    });
    if (enabled.has("orders")) {
      metrics.push({ label: "Laufende Bestellungen", value: String(myOrders), helper: "noch nicht abgeschlossen", href: "/bestellungen/meine" });
    }
    if (enabled.has("approvals") && managing) {
      metrics.push({ label: "Offene Freigaben", value: String(openApprovals), helper: "warten auf Entscheidung", href: "/freigaben" });
    }
    if (enabled.has("tickets")) {
      metrics.push({ label: "Meine Tickets", value: String(myTickets), helper: "offen oder in Bearbeitung", href: "/tickets" });
    }
    if (enabled.has("absences")) {
      metrics.push({ label: "Abwesenheitsanträge", value: String(openAbsences), helper: "in Freigabe", href: "/abwesenheiten" });
    }

    return metrics;
  }

  /* ------------------------------------------------------------ Suche */

  /** Modulübergreifende Suche; abgeschaltete Module werden übersprungen. */
  async search(user: RequestUser, query: string): Promise<SearchHit[]> {
    const term = query.trim();
    if (term.length < 2) {
      return [];
    }

    const enabled = await this.modules.enabledKeys();
    const like = { contains: term, mode: "insensitive" as const };
    const managing = isManaging(user);

    const [news, documents, wiki, people, tickets] = await Promise.all([
      enabled.has("news")
        ? this.prisma.newsPost.findMany({
            where: {
              status: "published",
              ...audienceFilter(user),
              OR: [{ title: like }, { teaser: like }, { content: like }],
            },
            select: { id: true, slug: true, title: true, teaser: true },
            take: 5,
          })
        : [],
      enabled.has("documents")
        ? this.prisma.document.findMany({
            where: { isActive: true, ...audienceFilter(user), OR: [{ title: like }, { description: like }] },
            select: { id: true, title: true, category: true, description: true },
            take: 5,
          })
        : [],
      enabled.has("wiki")
        ? this.prisma.wikiArticle.findMany({
            where: { isPublished: true, OR: [{ title: like }, { content: like }] },
            select: { id: true, slug: true, title: true, content: true },
            take: 5,
          })
        : [],
      enabled.has("directory")
        ? this.prisma.user.findMany({
            where: {
              status: "active",
              OR: [{ firstName: like }, { lastName: like }, { jobTitle: like }, { email: like }],
            },
            select: { id: true, firstName: true, lastName: true, jobTitle: true },
            take: 5,
          })
        : [],
      enabled.has("tickets")
        ? this.prisma.ticket.findMany({
            where: {
              ...(managing ? {} : { OR: [{ requesterId: user.id }, { assigneeId: user.id }] }),
              AND: [{ OR: [{ title: like }, { number: like }, { description: like }] }],
            },
            select: { id: true, number: true, title: true, description: true },
            take: 5,
          })
        : [],
    ]);

    const label = (key: string) => getModule(key)?.label ?? key;

    return [
      ...news.map((entry) => ({
        module: "news",
        moduleLabel: label("news"),
        id: entry.id,
        title: entry.title,
        snippet: entry.teaser,
        href: `/aktuelles/${entry.slug}`,
      })),
      ...documents.map((entry) => ({
        module: "documents",
        moduleLabel: label("documents"),
        id: entry.id,
        title: entry.title,
        snippet: entry.description ?? entry.category,
        href: "/dokumente",
      })),
      ...wiki.map((entry) => ({
        module: "wiki",
        moduleLabel: label("wiki"),
        id: entry.id,
        title: entry.title,
        snippet: entry.content.replace(/\s+/g, " ").slice(0, 140),
        href: `/wissen/${entry.slug}`,
      })),
      ...people.map((entry) => ({
        module: "directory",
        moduleLabel: label("directory"),
        id: entry.id,
        title: displayName(entry),
        snippet: entry.jobTitle,
        href: "/mitarbeiter",
      })),
      ...tickets.map((entry) => ({
        module: "tickets",
        moduleLabel: label("tickets"),
        id: entry.id,
        title: `${entry.number} · ${entry.title}`,
        snippet: entry.description.slice(0, 140),
        href: "/tickets",
      })),
    ];
  }

  /* ------------------------------------------------------------ Admin */

  async adminSummary() {
    const [users, roles, orders, approvals, documents, tickets, ideas, absences, news, auditCount] = await Promise.all([
      this.prisma.user.count({ where: { status: "active" } }),
      this.prisma.role.count(),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: "submitted" } }),
      this.prisma.document.count({ where: { isActive: true } }),
      this.prisma.ticket.count({ where: { status: { not: "geloest" } } }),
      this.prisma.idea.count({ where: { status: { in: ["neu", "in_pruefung"] } } }),
      this.prisma.absence.count({ where: { status: "submitted" } }),
      this.prisma.newsPost.count({ where: { status: "published" } }),
      this.prisma.auditLog.count(),
    ]);

    return {
      metrics: [
        { label: "Aktive Benutzer", value: String(users), helper: "mit Zugang zum Intranet" },
        { label: "Rollen", value: String(roles), helper: "mit hinterlegten Rechten" },
        { label: "Bestellungen", value: String(orders), helper: `davon ${approvals} in Freigabe` },
        { label: "Dokumente", value: String(documents), helper: "aktiv veröffentlicht" },
        { label: "Offene Tickets", value: String(tickets), helper: "interne Serviceanfragen" },
        { label: "Offene Ideen", value: String(ideas), helper: "neu oder in Prüfung" },
        { label: "Abwesenheitsanträge", value: String(absences), helper: "warten auf Freigabe" },
        { label: "Veröffentlichte News", value: String(news), helper: `${auditCount} Audit-Ereignisse` },
      ] satisfies DashboardMetric[],
    };
  }

  async auditLog(filter: { search?: string; action?: string; take?: number } = {}): Promise<AuditLogItem[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(filter.action && filter.action !== "all" ? { action: filter.action } : {}),
        ...(filter.search
          ? {
              OR: [
                { detail: { contains: filter.search, mode: "insensitive" } },
                { actorUsername: { contains: filter.search, mode: "insensitive" } },
                { action: { contains: filter.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: filter.take ?? 200,
    });

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      actor: row.actorUsername,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      detail: row.detail,
    }));
  }
}
