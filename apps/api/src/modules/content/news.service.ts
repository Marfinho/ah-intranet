import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { NewsItem, NewsPriority, NewsStatus } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { ZielgruppenService } from "../../core/zielgruppen.service";
import { requireTenantId } from "../../core/tenant-context";
import { AuditService } from "../../core/audit.service";
import { NotificationsService } from "../../core/notifications.service";
import { audienceFilter, displayName, toIso } from "../../core/mappers";
import { can, type RequestUser } from "../../core/request-user";

export interface NewsFilter {
  search?: string;
  priority?: string;
  status?: string;
  onlyUnread?: boolean;
  take?: number;
}

export interface NewsInput {
  title: string;
  teaser: string;
  content: string;
  priority: NewsPriority;
  status: NewsStatus;
  audienceScopes: string[];
  pinned?: boolean;
  expiresAt?: string | null;
}

const newsInclude = {
  author: { select: { firstName: true, lastName: true } },
  attachments: true,
  _count: { select: { comments: true } },
} as const;

@Injectable()
export class NewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly zielgruppen: ZielgruppenService,
  ) {}

  /**
   * Sichtbare Beiträge. Für Redaktionsrollen optional inklusive Entwürfen;
   * für alle anderen strikt auf veröffentlicht, Zielgruppe und Laufzeit gefiltert.
   */
  async list(user: RequestUser, filter: NewsFilter = {}): Promise<NewsItem[]> {
    const canSeeDrafts = can(user, "news.publish");
    const where: Prisma.NewsPostWhereInput = {
      ...(canSeeDrafts && filter.status && filter.status !== "all"
        ? { status: filter.status as NewsStatus }
        : canSeeDrafts && filter.status === "all"
          ? {}
          : { status: "published", publishedAt: { lte: new Date() } }),
      ...(canSeeDrafts ? {} : audienceFilter(user)),
      ...(filter.priority && filter.priority !== "all" ? { priority: filter.priority as NewsPriority } : {}),
      ...(filter.onlyUnread ? { reads: { none: { userId: user.id } } } : {}),
      // Laufzeit und Suche tragen beide ein OR. Nebeneinander im selben Objekt
      // gewönne das zweite, und abgelaufene Beiträge kämen über die Suche
      // zurück - genau am Sichtbarkeitsfenster vorbei.
      AND: [
        ...(canSeeDrafts ? [] : [{ OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] }]),
        ...(filter.search
          ? [
              {
                OR: [
                  { title: { contains: filter.search, mode: "insensitive" as const } },
                  { teaser: { contains: filter.search, mode: "insensitive" as const } },
                  { content: { contains: filter.search, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
      ],
    };

    const posts = await this.prisma.newsPost.findMany({
      where,
      include: { ...newsInclude, reads: { where: { userId: user.id }, select: { id: true } } },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      take: filter.take ?? 50,
    });

    return posts.map((post) => this.toNewsItem(post, post.reads.length > 0));
  }

  async detail(user: RequestUser, slug: string): Promise<NewsItem> {
    const post = await this.prisma.newsPost.findFirst({
      where: { slug },
      include: {
        ...newsInclude,
        reads: { where: { userId: user.id }, select: { id: true } },
        comments: {
          include: { author: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!post) {
      throw new NotFoundException("Beitrag nicht gefunden");
    }
    if (!this.canView(user, post)) {
      throw new ForbiddenException("Dieser Beitrag ist nicht für Sie freigegeben.");
    }

    return {
      ...this.toNewsItem(post, post.reads.length > 0),
      comments: post.comments.map((comment) => ({
        id: comment.id,
        author: displayName(comment.author),
        message: comment.message,
        createdAt: comment.createdAt.toISOString(),
      })),
    };
  }

  async markRead(user: RequestUser, slug: string): Promise<void> {
    const post = await this.prisma.newsPost.findFirst({ where: { slug }, select: { id: true } });
    if (!post) {
      throw new NotFoundException("Beitrag nicht gefunden");
    }
    await this.prisma.newsRead.upsert({
      where: { tenantId_newsPostId_userId: { tenantId: requireTenantId(), newsPostId: post.id, userId: user.id } },
      update: {},
      create: { newsPostId: post.id, userId: user.id },
    });
  }

  async comment(user: RequestUser, slug: string, message: string): Promise<void> {
    const post = await this.prisma.newsPost.findFirst({
      where: { slug },
      select: { id: true, authorId: true, title: true },
    });
    if (!post) {
      throw new NotFoundException("Beitrag nicht gefunden");
    }

    await this.prisma.newsComment.create({ data: { newsPostId: post.id, authorId: user.id, message } });

    if (post.authorId !== user.id) {
      await this.notifications.notify({
        userIds: [post.authorId],
        title: "Neuer Kommentar",
        detail: `${user.displayName} hat "${post.title}" kommentiert.`,
        link: `/aktuelles/${slug}`,
      });
    }
  }

  async create(user: RequestUser, input: NewsInput): Promise<NewsItem> {
    const slug = await this.uniqueSlug(input.title);
    const publish = input.status === "published";

    const post = await this.prisma.newsPost.create({
      data: {
        slug,
        title: input.title,
        teaser: input.teaser,
        content: input.content,
        priority: input.priority,
        status: input.status,
        pinned: input.pinned ?? false,
        audienceScopes: await this.zielgruppen.pruefe(input.audienceScopes),
        publishedAt: publish ? new Date() : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        authorId: user.id,
      },
      include: newsInclude,
    });

    await this.audit.log({
      actor: user,
      action: "news.create",
      entityType: "news",
      entityId: post.id,
      detail: `Beitrag "${post.title}" ${publish ? "veröffentlicht" : "als Entwurf gespeichert"}`,
    });

    if (publish) {
      await this.notifyAudience(post.audienceScopes, post.title, post.teaser, slug, post.priority);
    }

    return this.toNewsItem(post, true);
  }

  async update(user: RequestUser, id: string, input: Partial<NewsInput>): Promise<NewsItem> {
    const existing = await this.prisma.newsPost.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Beitrag nicht gefunden");
    }

    const goesLive = input.status === "published" && existing.status !== "published";

    const post = await this.prisma.newsPost.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.teaser !== undefined ? { teaser: input.teaser } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
        ...(input.audienceScopes !== undefined
          ? { audienceScopes: await this.zielgruppen.pruefe(input.audienceScopes) }
          : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
        ...(goesLive ? { publishedAt: new Date() } : {}),
      },
      include: newsInclude,
    });

    await this.audit.log({
      actor: user,
      action: "news.update",
      entityType: "news",
      entityId: post.id,
      detail: `Beitrag "${post.title}" bearbeitet`,
    });

    if (goesLive) {
      await this.notifyAudience(post.audienceScopes, post.title, post.teaser, post.slug, post.priority);
    }

    return this.toNewsItem(post, true);
  }

  async remove(user: RequestUser, id: string): Promise<void> {
    const post = await this.prisma.newsPost.findUnique({ where: { id }, select: { title: true } });
    if (!post) {
      throw new NotFoundException("Beitrag nicht gefunden");
    }
    await this.prisma.newsPost.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: "news.delete",
      entityType: "news",
      entityId: id,
      detail: `Beitrag "${post.title}" gelöscht`,
    });
  }

  /** Benachrichtigt genau die Personen, deren Zielgruppen-Tokens den Beitrag treffen. */
  private async notifyAudience(
    scopes: string[],
    title: string,
    teaser: string,
    slug: string,
    priority: string,
  ): Promise<void> {
    if (priority !== "hoch" && priority !== "kritisch") {
      return;
    }
    const recipients = await this.prisma.user.findMany({
      where: { status: "active", scopes: { hasSome: scopes } },
      select: { id: true },
    });
    await this.notifications.notify({
      userIds: recipients.map((entry) => entry.id),
      title: `Wichtige News: ${title}`,
      detail: teaser,
      link: `/aktuelles/${slug}`,
    });
  }

  private canView(
    user: RequestUser,
    post: { status: string; audienceScopes: string[]; expiresAt: Date | null },
  ): boolean {
    if (can(user, "news.publish")) {
      return true;
    }
    if (post.status !== "published") {
      return false;
    }
    if (post.expiresAt && post.expiresAt < new Date()) {
      return false;
    }
    return post.audienceScopes.some((scope) => user.scopes.includes(scope));
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base =
      title
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 60) || "beitrag";

    const taken = await this.prisma.newsPost.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    if (!taken.some((entry) => entry.slug === base)) {
      return base;
    }
    let suffix = 2;
    while (taken.some((entry) => entry.slug === `${base}-${suffix}`)) {
      suffix += 1;
    }
    return `${base}-${suffix}`;
  }

  private toNewsItem(post: Prisma.NewsPostGetPayload<{ include: typeof newsInclude }>, read: boolean): NewsItem {
    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      teaser: post.teaser,
      content: post.content,
      priority: post.priority,
      status: post.status,
      publishedAt: toIso(post.publishedAt),
      expiresAt: toIso(post.expiresAt),
      author: displayName(post.author),
      audienceScopes: post.audienceScopes,
      attachments: post.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        type: attachment.type,
        url: attachment.url,
      })),
      commentCount: post._count.comments,
      read,
      pinned: post.pinned,
    };
  }
}
