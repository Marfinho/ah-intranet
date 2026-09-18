import { Module } from "@nestjs/common";
import {
  DocumentsController,
  NewsController,
  QuickLinksController,
  WikiController,
} from "./content.controller";
import { NewsService } from "./news.service";
import { DocumentsService } from "./documents.service";
import { QuickLinksService } from "./quicklinks.service";

@Module({
  controllers: [NewsController, DocumentsController, WikiController, QuickLinksController],
  providers: [NewsService, DocumentsService, QuickLinksService],
  exports: [NewsService, DocumentsService, QuickLinksService],
})
export class ContentModule {}
