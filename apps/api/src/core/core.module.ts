import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { AuditService } from "./audit.service";
import { ModuleRegistryService } from "./module-registry.service";
import { NotificationsService } from "./notifications.service";
import { TenantService } from "./tenant.service";
import { MailerService } from "./mailer";
import { SystemMonitorService } from "./system-monitor.service";

/** Querschnittsdienste, die jedes Fachmodul braucht. */
@Global()
@Module({
  providers: [
    PrismaService,
    AuditService,
    ModuleRegistryService,
    NotificationsService,
    TenantService,
    MailerService,
    SystemMonitorService,
  ],
  exports: [
    PrismaService,
    AuditService,
    ModuleRegistryService,
    NotificationsService,
    TenantService,
    MailerService,
    SystemMonitorService,
  ],
})
export class CoreModule {}
