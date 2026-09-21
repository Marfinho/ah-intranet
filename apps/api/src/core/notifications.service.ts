import { Injectable, Logger } from "@nestjs/common";
import type { NotificationItem } from "@ah-intranet/shared";
import { PrismaService } from "./prisma.service";
import { toIso } from "./mappers";
import type { RequestUser } from "./request-user";

export interface NotifyInput {
  userIds: string[];
  title: string;
  detail: string;
  link?: string;
}

/**
 * Zustellung von In-App-Benachrichtigungen. Liegt im Core, weil praktisch jedes
 * Fachmodul Ereignisse meldet (Freigabe erteilt, Ticket zugewiesen, News erschienen).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(input: NotifyInput): Promise<void> {
    const userIds = [...new Set(input.userIds)].filter(Boolean);
    if (userIds.length === 0) {
      return;
    }

    try {
      await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          title: input.title,
          detail: input.detail,
          link: input.link ?? null,
        })),
      });
    } catch (error) {
      this.logger.error(`Benachrichtigung "${input.title}" konnte nicht zugestellt werden`, error as Error);
    }
  }

  /**
   * Aktive Konten, deren Rollen das genannte Recht tragen.
   *
   * Bewusst über das Recht und nicht über einen Rollenschlüssel: welche Rolle
   * freigibt oder Anfragen bearbeitet, entscheidet jedes Haus selbst. Eine
   * eigene Rolle "Werkstattleitung" mit `orders.approve` bekäme sonst nie eine
   * Meldung - der Vorgang bliebe liegen, ohne dass jemand etwas davon merkt.
   */
  async userIdsWithPermission(permission: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { role: { permissions: { some: { permission: { key: permission } } } }, user: { status: "active" } },
      select: { userId: true },
    });
    return [...new Set(rows.map((row) => row.userId))];
  }

  async list(user: RequestUser, onlyUnread = false): Promise<NotificationItem[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId: user.id, ...(onlyUnread ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      detail: row.detail,
      channel: row.channel,
      link: row.link,
      createdAt: row.createdAt.toISOString(),
      read: row.readAt !== null,
    }));
  }

  async unreadCount(user: RequestUser): Promise<number> {
    return this.prisma.notification.count({ where: { userId: user.id, readAt: null } });
  }

  async markRead(user: RequestUser, id: string): Promise<NotificationItem | null> {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      return null;
    }
    const row = await this.prisma.notification.findUnique({ where: { id } });
    return row
      ? {
          id: row.id,
          title: row.title,
          detail: row.detail,
          channel: row.channel,
          link: row.link,
          createdAt: row.createdAt.toISOString(),
          read: toIso(row.readAt) !== null,
        }
      : null;
  }

  async markAllRead(user: RequestUser): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }
}
