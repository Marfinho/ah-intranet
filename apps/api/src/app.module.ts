import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";
import { AuthModule } from "./modules/auth/auth.module";
import { NewsModule } from "./modules/news/news.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AuditModule } from "./modules/audit/audit.module";
import { UsersModule } from "./modules/users/users.module";
import { RolesModule } from "./modules/roles/roles.module";
import { OrderCyclesModule } from "./modules/order-cycles/order-cycles.module";
import { DirectoryModule } from "./modules/directory/directory.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { CalendarModule } from "./modules/calendar/calendar.module";
import { TicketsModule } from "./modules/tickets/tickets.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
import { DemoRoleGuard } from "./common/demo-role.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    RolesModule,
    NewsModule,
    OrdersModule,
    OrderCyclesModule,
    DirectoryModule,
    DocumentsModule,
    NotificationsModule,
    CalendarModule,
    TicketsModule,
    OnboardingModule,
    AdminModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: DemoRoleGuard,
    },
  ],
})
export class AppModule {}
