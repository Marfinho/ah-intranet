import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { CoreModule } from "./core/core.module";
import { TenantMiddleware } from "./core/tenant.middleware";
import { JwtAuthGuard, ModuleEnabledGuard, RolesGuard } from "./core/guards";
import { AuthModule } from "./modules/auth/auth.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { ContentModule } from "./modules/content/content.module";
import { PeopleModule } from "./modules/people/people.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { ResourcesModule } from "./modules/resources/resources.module";
import { ServiceDeskModule } from "./modules/servicedesk/servicedesk.module";
import { PrivacyModule } from "./modules/privacy/privacy.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Grunddrosselung gegen automatisierte Zugriffe. Der Login ist zusätzlich
    // enger begrenzt und kennt eine Kontosperre.
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 300 }]),
    CoreModule,
    AuthModule,
    ContentModule,
    PeopleModule,
    OrdersModule,
    ResourcesModule,
    ServiceDeskModule,
    PlatformModule,
    PrivacyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Reihenfolge ist bedeutsam: erst drosseln, dann authentifizieren, dann
    // Rollen prüfen, zuletzt die Modulaktivierung - so kann eine anonyme
    // Anfrage nie erfahren, welche Module geschaltet sind.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ModuleEnabledGuard },
  ],
})
export class AppModule implements NestModule {
  /**
   * Der Mandantenkontext muss vor allem anderen stehen: auch die Guards greifen
   * auf die Datenbank zu und müssen bereits gefiltert arbeiten.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes("*");
  }
}
