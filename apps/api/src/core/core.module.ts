import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { AuditService } from "./audit.service";
import { ModuleRegistryService } from "./module-registry.service";
import { NotificationsService } from "./notifications.service";
import { MailService } from "./mail.service";
import { TenantService } from "./tenant.service";
import { ZielgruppenService } from "./zielgruppen.service";
import { ZielgruppenController } from "./zielgruppen.controller";

/** Querschnittsdienste, die jedes Fachmodul braucht. */
@Global()
@Module({
  controllers: [ZielgruppenController],
  providers: [
    PrismaService,
    AuditService,
    ModuleRegistryService,
    NotificationsService,
    TenantService,
    MailService,
    ZielgruppenService,
  ],
  exports: [
    PrismaService,
    AuditService,
    ModuleRegistryService,
    NotificationsService,
    TenantService,
    MailService,
    ZielgruppenService,
  ],
})
export class CoreModule {}
