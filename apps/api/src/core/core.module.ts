import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { AuditService } from "./audit.service";
import { ModuleRegistryService } from "./module-registry.service";
import { NotificationsService } from "./notifications.service";

/** Querschnittsdienste, die jedes Fachmodul braucht. */
@Global()
@Module({
  providers: [PrismaService, AuditService, ModuleRegistryService, NotificationsService],
  exports: [PrismaService, AuditService, ModuleRegistryService, NotificationsService],
})
export class CoreModule {}
