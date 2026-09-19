import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import type { DocumentFileType, NewsPriority, NewsStatus } from "@ah-intranet/shared";
import { NewsService } from "./news.service";
import { DocumentsService } from "./documents.service";
import { QuickLinksService } from "./quicklinks.service";
import { CurrentUser, Feature, Permission } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

/* ------------------------------------------------------------------ DTOs */

class NewsBodyDto {
  @IsString() @MinLength(3) @MaxLength(180) title!: string;
  @IsString() @MinLength(3) teaser!: string;
  @IsString() @MinLength(3) content!: string;
  @IsIn(["niedrig", "normal", "hoch", "kritisch"]) priority!: NewsPriority;
  @IsIn(["draft", "published", "archived"]) status!: NewsStatus;
  @IsArray() @IsString({ each: true }) audienceScopes!: string[];
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsString() expiresAt?: string | null;
}

class NewsPatchDto {
  @IsOptional() @IsString() @MinLength(3) title?: string;
  @IsOptional() @IsString() teaser?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsIn(["niedrig", "normal", "hoch", "kritisch"]) priority?: NewsPriority;
  @IsOptional() @IsIn(["draft", "published", "archived"]) status?: NewsStatus;
  @IsOptional() @IsArray() @IsString({ each: true }) audienceScopes?: string[];
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsString() expiresAt?: string | null;
}

class CommentDto {
  @IsString() @MinLength(2) @MaxLength(2000) message!: string;
}

class DocumentBodyDto {
  @IsString() @MinLength(2) title!: string;
  @IsString() @MinLength(2) category!: string;
  @IsOptional() @IsString() description?: string;
  @IsIn(["pdf", "docx", "xlsx", "link"]) fileType!: DocumentFileType;
  @IsString() @MinLength(1) url!: string;
  @IsArray() @IsString({ each: true }) audienceScopes!: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class DocumentPatchDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(["pdf", "docx", "xlsx", "link"]) fileType?: DocumentFileType;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) audienceScopes?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class WikiBodyDto {
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(2) category!: string;
  @IsString() @MinLength(3) content!: string;
  @IsArray() @IsString({ each: true }) tags!: string[];
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

class WikiPatchDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

class QuickLinkBodyDto {
  @IsString() @MinLength(2) label!: string;
  @IsString() @MinLength(2) url!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @ArrayNotEmpty() @IsString({ each: true }) audienceScopes?: string[];
}

/* ------------------------------------------------------------ Controller */

@Controller("news")
@Feature("news")
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("search") search?: string,
    @Query("priority") priority?: string,
    @Query("status") status?: string,
    @Query("unread") unread?: string,
  ) {
    return this.news.list(user, { search, priority, status, onlyUnread: unread === "true" });
  }

  @Get(":slug")
  detail(@CurrentUser() user: RequestUser, @Param("slug") slug: string) {
    return this.news.detail(user, slug);
  }

  @Post(":slug/read")
  @HttpCode(204)
  markRead(@CurrentUser() user: RequestUser, @Param("slug") slug: string) {
    return this.news.markRead(user, slug);
  }

  @Post(":slug/comments")
  @HttpCode(201)
  comment(@CurrentUser() user: RequestUser, @Param("slug") slug: string, @Body() dto: CommentDto) {
    return this.news.comment(user, slug, dto.message);
  }

  @Post()
  @Permission("news.publish")
  create(@CurrentUser() user: RequestUser, @Body() dto: NewsBodyDto) {
    return this.news.create(user, dto);
  }

  @Patch(":id")
  @Permission("news.publish")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: NewsPatchDto) {
    return this.news.update(user, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  @Permission("news.publish")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.news.remove(user, id);
  }
}

@Controller("documents")
@Feature("documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("search") search?: string, @Query("category") category?: string) {
    return this.documents.list(user, { search, category });
  }

  @Post()
  @Permission("documents.manage")
  create(@CurrentUser() user: RequestUser, @Body() dto: DocumentBodyDto) {
    return this.documents.create(user, dto);
  }

  @Patch(":id")
  @Permission("documents.manage")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: DocumentPatchDto) {
    return this.documents.update(user, id, dto);
  }

  @Delete(":id")
  @Permission("documents.manage")
  @HttpCode(204)
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.documents.remove(user, id);
  }
}

@Controller("wiki")
@Feature("wiki")
export class WikiController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("search") search?: string, @Query("category") category?: string) {
    return this.documents.listWiki(user, { search, category });
  }

  @Get(":slug")
  detail(@Param("slug") slug: string) {
    return this.documents.wikiDetail(slug);
  }

  @Post()
  @Permission("wiki.manage")
  create(@CurrentUser() user: RequestUser, @Body() dto: WikiBodyDto) {
    return this.documents.createWiki(user, dto);
  }

  @Patch(":id")
  @Permission("wiki.manage")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: WikiPatchDto) {
    return this.documents.updateWiki(user, id, dto);
  }

  @Delete(":id")
  @Permission("wiki.manage")
  @HttpCode(204)
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.documents.removeWiki(user, id);
  }
}

@Controller("quicklinks")
@Feature("quicklinks")
export class QuickLinksController {
  constructor(private readonly quickLinks: QuickLinksService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("all") all?: string) {
    return this.quickLinks.list(user, all === "true");
  }

  @Post()
  @Permission("quicklinks.manage")
  create(@CurrentUser() user: RequestUser, @Body() dto: QuickLinkBodyDto) {
    return this.quickLinks.create(user, dto);
  }

  @Patch(":id")
  @Permission("quicklinks.manage")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: QuickLinkBodyDto) {
    return this.quickLinks.update(user, id, dto);
  }

  @Delete(":id")
  @Permission("quicklinks.manage")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.quickLinks.remove(user, id);
  }
}
