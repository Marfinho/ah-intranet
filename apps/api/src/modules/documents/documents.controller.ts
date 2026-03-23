import { Controller, Get } from "@nestjs/common";
import { documents } from "@ah-intranet/shared";

@Controller("documents")
export class DocumentsController {
  @Get()
  findAll() {
    return documents;
  }
}
