import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { AuditService } from "./audit.service";
import { ModuleRegistryService } from "./module-registry.service";
import { NotificationsService } from "./notifications.service";
import { MailService } from "./mail.service";
import { TenantService } from "./tenant.service";

/** Querschnittsdienste, die jedes Fachmodul braucht. */
@Global()
@Module({
  providers: [PrismaService, AuditService, ModuleRegistryService, NotificationsService, TenantService, MailService],
  exports: [PrismaService, AuditService, ModuleRegistryService, NotificationsService, TenantService, MailService],
})
export class CoreModule {}
