import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { RequireRoles } from "../../common/roles.decorator";
import { NewsService } from "./news.service";
import { CreateNewsDto } from "./dto/create-news.dto";

@Controller("news")
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  findAll() {
    return this.newsService.findAll();
  }

  @Get(":slug")
  findOne(@Param("slug") slug: string) {
    return this.newsService.findBySlug(slug);
  }

  @Post()
  @RequireRoles("admin", "fachbereichsadmin")
  create(@Body() dto: CreateNewsDto) {
    return this.newsService.create(dto);
  }
}
