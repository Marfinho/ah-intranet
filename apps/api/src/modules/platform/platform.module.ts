import { Module } from "@nestjs/common";
import { AdminController, AuditController, DashboardController, SearchController } from "./platform.controller";
import { ModulesController } from "./modules.controller";
import { PlatformService } from "./platform.service";
import { ContentModule } from "../content/content.module";
import { OrdersModule } from "../orders/orders.module";
import { ServiceDeskModule } from "../servicedesk/servicedesk.module";
import { ResourcesModule } from "../resources/resources.module";
import { PeopleModule } from "../people/people.module";

@Module({
  imports: [ContentModule, OrdersModule, ServiceDeskModule, ResourcesModule, PeopleModule],
  controllers: [DashboardController, SearchController, AdminController, AuditController, ModulesController],
  providers: [PlatformService],
})
export class PlatformModule {}
