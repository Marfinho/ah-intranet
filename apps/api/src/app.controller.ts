import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";
import { Public } from "./core/decorators";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get("health")
  getHealth() {
    return this.appService.getHealth();
  }
}
