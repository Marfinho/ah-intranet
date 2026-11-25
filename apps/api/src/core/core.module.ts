import { Global, Module } from "@nestjs/common";
import { PrismaLebenszyklus, PrismaService } from "./prisma.service";
import { AuditService } from "./audit.service";
import { ModuleRegistryService } from "./module-registry.service";
import { NotificationsService } from "./notifications.service";
import { MailService } from "./mail.service";
import { TenantService } from "./tenant.service";
import { TlsController } from "./tls.controller";

/** Querschnittsdienste, die jedes Fachmodul braucht. */
@Global()
@Module({
  controllers: [TlsController],
  providers: [
    PrismaService,
    PrismaLebenszyklus,
    AuditService,
    ModuleRegistryService,
    NotificationsService,
    TenantService,
    MailService,
  ],
  exports: [PrismaService, AuditService, ModuleRegistryService, NotificationsService, TenantService, MailService],
})
export class CoreModule {}
