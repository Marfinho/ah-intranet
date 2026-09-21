import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { DocumentFileType, DocumentItem, WikiArticle } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { ZielgruppenService } from "../../core/zielgruppen.service";
import { AuditService } from "../../core/audit.service";
import { audienceFilter, displayName } from "../../core/mappers";
import { can, type RequestUser } from "../../core/request-user";

export interface DocumentInput {
  title: string;
  category: string;
  description?: string;
  fileType: DocumentFileType;
  url: string;
  audienceScopes: string[];
  isActive?: boolean;
}

export interface WikiInput {
  title: string;
  category: string;
  content: string;
  tags: string[];
  isPublished?: boolean;
  audienceScopes?: string[];
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly zielgruppen: ZielgruppenService,
  ) {}

  async list(user: RequestUser, filter: { search?: string; category?: string } = {}) {
    const where: Prisma.DocumentWhereInput = {
      ...(can(user, "documents.manage") ? {} : { isActive: true, ...audienceFilter(user) }),
      ...(filter.category && filter.category !== "all" ? { category: filter.category } : {}),
      ...(filter.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: "insensitive" } },
              { description: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [documents, categories] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: { owner: { select: { firstName: true, lastName: true } } },
        orderBy: [{ category: "asc" }, { title: "asc" }],
      }),
      this.prisma.document.findMany({
        where: can(user, "documents.manage") ? {} : { isActive: true, ...audienceFilter(user) },
        distinct: ["category"],
        select: { category: true },
        orderBy: { category: "asc" },
      }),
    ]);

    return {
      items: documents.map((document) => this.toDocument(document)),
      categories: categories.map((entry) => entry.category),
    };
  }

  async create(user: RequestUser, input: DocumentInput): Promise<DocumentItem> {
    const document = await this.prisma.document.create({
      data: {
        title: input.title,
        category: input.category,
        description: input.description ?? null,
        fileType: input.fileType,
        url: input.url,
        audienceScopes: await this.zielgruppen.pruefe(input.audienceScopes),
        isActive: input.isActive ?? true,
        ownerId: user.id,
      },
      include: { owner: { select: { firstName: true, lastName: true } } },
    });

    await this.audit.log({
      actor: user,
      action: "document.create",
      entityType: "document",
      entityId: document.id,
      detail: `Dokument "${document.title}" angelegt`,
    });

    return this.toDocument(document);
  }

  async update(user: RequestUser, id: string, input: Partial<DocumentInput>): Promise<DocumentItem> {
    await this.ensureDocument(id);
    const document = await this.prisma.document.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.fileType !== undefined ? { fileType: input.fileType } : {}),
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.audienceScopes !== undefined
          ? { audienceScopes: await this.zielgruppen.pruefe(input.audienceScopes) }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: { owner: { select: { firstName: true, lastName: true } } },
    });

    await this.audit.log({
      actor: user,
      action: "document.update",
      entityType: "document",
      entityId: id,
      detail: `Dokument "${document.title}" bearbeitet`,
    });

    return this.toDocument(document);
  }

  async remove(user: RequestUser, id: string): Promise<void> {
    const document = await this.ensureDocument(id);
    await this.prisma.document.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: "document.delete",
      entityType: "document",
      entityId: id,
      detail: `Dokument "${document.title}" gelöscht`,
    });
  }

  /* ------------------------------------------------------------- Wiki */

  async listWiki(user: RequestUser, filter: { search?: string; category?: string } = {}) {
    const where: Prisma.WikiArticleWhereInput = {
      // Wer das Wissen pflegt, sieht alles - sonst wären fremde Zielgruppen
      // beim Bearbeiten unsichtbar und würden beim Speichern überschrieben.
      ...(can(user, "wiki.manage") ? {} : { isPublished: true, ...audienceFilter(user) }),
      ...(filter.category && filter.category !== "all" ? { category: filter.category } : {}),
      ...(filter.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: "insensitive" } },
              { content: { contains: filter.search, mode: "insensitive" } },
              { tags: { has: filter.search.toLowerCase() } },
            ],
          }
        : {}),
    };

    const [articles, categories] = await Promise.all([
      this.prisma.wikiArticle.findMany({
        where,
        include: { author: { select: { firstName: true, lastName: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.wikiArticle.findMany({
        where: can(user, "wiki.manage") ? {} : { isPublished: true },
        distinct: ["category"],
        select: { category: true },
        orderBy: { category: "asc" },
      }),
    ]);

    return {
      items: articles.map((article) => this.toWiki(article, false)),
      categories: categories.map((entry) => entry.category),
    };
  }

  async wikiDetail(user: RequestUser, slug: string): Promise<WikiArticle> {
    const article = await this.prisma.wikiArticle.findFirst({
      where: {
        slug,
        // Ohne diese Bedingung wäre die Zielgruppe nur eine Sortierhilfe: der
        // Slug steht in jeder Suchtreffer-Liste und wäre der Weg daran vorbei.
        ...(can(user, "wiki.manage") ? {} : { isPublished: true, ...audienceFilter(user) }),
      },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    if (!article) {
      throw new NotFoundException("Artikel nicht gefunden");
    }
    return this.toWiki(article, true);
  }

  async createWiki(user: RequestUser, input: WikiInput): Promise<WikiArticle> {
    const article = await this.prisma.wikiArticle.create({
      data: {
        slug: await this.uniqueWikiSlug(input.title),
        title: input.title,
        category: input.category,
        content: input.content,
        tags: input.tags.map((tag) => tag.toLowerCase()),
        isPublished: input.isPublished ?? true,
        audienceScopes: await this.zielgruppen.pruefe(input.audienceScopes),
        authorId: user.id,
      },
      include: { author: { select: { firstName: true, lastName: true } } },
    });

    await this.audit.log({
      actor: user,
      action: "wiki.create",
      entityType: "wiki",
      entityId: article.id,
      detail: `Wiki-Artikel "${article.title}" angelegt`,
    });

    return this.toWiki(article, true);
  }

  async updateWiki(user: RequestUser, id: string, input: Partial<WikiInput>): Promise<WikiArticle> {
    const article = await this.prisma.wikiArticle.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.tags !== undefined ? { tags: input.tags.map((tag) => tag.toLowerCase()) } : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
        ...(input.audienceScopes !== undefined
          ? { audienceScopes: await this.zielgruppen.pruefe(input.audienceScopes) }
          : {}),
      },
      include: { author: { select: { firstName: true, lastName: true } } },
    });

    await this.audit.log({
      actor: user,
      action: "wiki.update",
      entityType: "wiki",
      entityId: id,
      detail: `Wiki-Artikel "${article.title}" bearbeitet`,
    });

    return this.toWiki(article, true);
  }

  async removeWiki(user: RequestUser, id: string): Promise<void> {
    const article = await this.prisma.wikiArticle.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: "wiki.delete",
      entityType: "wiki",
      entityId: id,
      detail: `Wiki-Artikel "${article.title}" gelöscht`,
    });
  }

  private async ensureDocument(id: string) {
    const document = await this.prisma.document.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!document) {
      throw new NotFoundException("Dokument nicht gefunden");
    }
    return document;
  }

  private async uniqueWikiSlug(title: string): Promise<string> {
    const base =
      title
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 60) || "artikel";
    const taken = await this.prisma.wikiArticle.findMany({
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

  private toDocument(
    document: Prisma.DocumentGetPayload<{ include: { owner: { select: { firstName: true; lastName: true } } } }>,
  ): DocumentItem {
    return {
      id: document.id,
      title: document.title,
      category: document.category,
      description: document.description,
      fileType: document.fileType,
      url: document.url,
      owner: displayName(document.owner),
      audienceScopes: document.audienceScopes,
      updatedAt: document.updatedAt.toISOString(),
      isActive: document.isActive,
    };
  }

  private toWiki(
    article: Prisma.WikiArticleGetPayload<{ include: { author: { select: { firstName: true; lastName: true } } } }>,
    withContent: boolean,
  ): WikiArticle {
    return {
      id: article.id,
      slug: article.slug,
      title: article.title,
      category: article.category,
      excerpt: article.content.replace(/\s+/g, " ").slice(0, 180),
      ...(withContent ? { content: article.content } : {}),
      tags: article.tags,
      author: displayName(article.author),
      updatedAt: article.updatedAt.toISOString(),
      isPublished: article.isPublished,
      audienceScopes: article.audienceScopes,
    };
  }
}
