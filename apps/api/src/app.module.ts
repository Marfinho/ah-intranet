import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { CoreModule } from "./core/core.module";
import { JwtAuthGuard, ModuleEnabledGuard, RolesGuard } from "./core/guards";
import { AuthModule } from "./modules/auth/auth.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { ContentModule } from "./modules/content/content.module";
import { PeopleModule } from "./modules/people/people.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { ResourcesModule } from "./modules/resources/resources.module";
import { ServiceDeskModule } from "./modules/servicedesk/servicedesk.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CoreModule,
    AuthModule,
    ContentModule,
    PeopleModule,
    OrdersModule,
    ResourcesModule,
    ServiceDeskModule,
    IntegrationsModule,
    PlatformModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Reihenfolge ist bedeutsam: erst authentifizieren, dann Rollen prüfen,
    // zuletzt die Modulaktivierung - so kann eine anonyme Anfrage nie erfahren,
    // welche Module geschaltet sind.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ModuleEnabledGuard },
  ],
})
export class AppModule {}
