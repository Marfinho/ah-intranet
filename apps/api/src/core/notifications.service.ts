import { Injectable, Logger } from "@nestjs/common";
import type { NotificationItem } from "@ah-intranet/shared";
import { PrismaService } from "./prisma.service";
import { MailService } from "./mail.service";
import { toIso } from "./mappers";
import type { RequestUser } from "./request-user";

export interface NotifyInput {
  userIds: string[];
  title: string;
  detail: string;
  link?: string;
  /**
   * Zusätzlich per E-Mail zustellen.
   *
   * Bewusst je Aufruf statt global: nicht jede Meldung rechtfertigt eine Mail.
   * Ein neuer Aushang nicht, eine Entscheidung über einen Antrag schon - die
   * erreicht sonst nur, wer zufällig hereinschaut.
   */
  auchPerMail?: boolean;
}

/**
 * Zustellung von In-App-Benachrichtigungen. Liegt im Core, weil praktisch jedes
 * Fachmodul Ereignisse meldet (Freigabe erteilt, Ticket zugewiesen, News erschienen).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

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
      return;
    }

    if (input.auchPerMail) {
      await this.perMail(userIds, input);
    }
  }

  /**
   * Schickt die Meldung zusätzlich per E-Mail.
   *
   * Läuft nach dem Schreiben in die Datenbank und wirft nicht: die
   * Benachrichtigung im Intranet steht, ob der Mailserver erreichbar war oder
   * nicht. Konten ohne Adresse werden übersprungen - eine E-Mail-Adresse ist
   * im Autohaus nicht selbstverständlich.
   */
  private async perMail(userIds: string[], input: NotifyInput): Promise<void> {
    if (!this.mail.istEingerichtet) {
      return;
    }

    const empfaenger = await this.prisma.user.findMany({
      where: { id: { in: userIds }, status: "active", email: { not: null } },
      select: { email: true },
    });

    const basis = process.env.FRONTEND_URL ?? "";
    const link = input.link && basis ? `\n\nIm Intranet ansehen: ${basis}${input.link}` : "";

    for (const person of empfaenger) {
      await this.mail.send({
        to: person.email!,
        subject: input.title,
        text: `${input.detail}${link}\n\n--\nAHOI - Autohaus Organisation & Information`,
      });
    }
  }

  /** Alle Benutzer einer Rolle, z. B. zur Information der Freigebenden. */
  async userIdsWithRole(roleKey: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { role: { key: roleKey }, user: { status: "active" } },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
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
