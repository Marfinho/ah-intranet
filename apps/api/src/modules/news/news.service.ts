import { Injectable, NotFoundException } from "@nestjs/common";
import { newsItems } from "@ah-intranet/shared";
import { AuditService } from "../audit/audit.service";
import { CreateNewsDto } from "./dto/create-news.dto";

@Injectable()
export class NewsService {
  private readonly items = [...newsItems];

  constructor(private readonly auditService: AuditService) {}

  findAll() {
    return this.items;
  }

  findBySlug(slug: string) {
    const item = this.items.find((news) => news.slug === slug);
    if (!item) {
      throw new NotFoundException("News nicht gefunden");
    }
    return item;
  }

  create(dto: CreateNewsDto) {
    const item = {
      id: `news-${this.items.length + 1}`,
      slug: dto.slug,
      title: dto.title,
      teaser: dto.teaser,
      content: dto.content,
      priority: dto.priority,
      publishedAt: dto.status === "published" ? new Date().toISOString() : new Date().toISOString(),
      expiresAt: dto.expiresAt,
      status: dto.status,
      audience: dto.audience,
      attachments: [],
      author: "admin",
    };

    this.items.unshift(item);
    this.auditService.log({
      actor: "admin",
      action: "news.create",
      entityType: "news_post",
      entityId: item.id,
      detail: `News ${item.title} erstellt`,
    });

    return item;
  }
}
