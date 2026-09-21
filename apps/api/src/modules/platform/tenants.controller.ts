import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Put } from "@nestjs/common";
import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";
import { AuditService } from "../../core/audit.service";
import { CurrentUser, PlatformAdmin } from "../../core/decorators";
import { ModuleRegistryService } from "../../core/module-registry.service";
import type { RequestUser } from "../../core/request-user";
import { TenantService } from "../../core/tenant.service";
import { runWithTenant } from "../../core/tenant-context";

class CreateTenantDto {
  @IsString()
  @IsNotEmpty({ message: "Kennung ist erforderlich" })
  slug!: string;

  @IsString()
  @IsNotEmpty({ message: "Name ist erforderlich" })
  name!: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  @IsNotEmpty({ message: "Benutzername des ersten Kontos ist erforderlich" })
  adminUsername!: string;

  @IsString()
  @MinLength(10, { message: "Das Startpasswort muss mindestens 10 Zeichen lang sein" })
  adminPassword!: string;

  @IsOptional()
  @IsString()
  adminFirstName?: string;

  @IsOptional()
  @IsString()
  adminLastName?: string;

  @IsOptional()
  @IsEmail({}, { message: "Bitte eine gültige E-Mail-Adresse angeben" })
  adminEmail?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  licensedSeats?: number;
}

class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

class SetLicenseDto {
  // Leer/`null` heißt unbegrenzt - deshalb kein @IsInt allein, sondern die
  // Prüfung im Dienst, der zwischen "nicht angegeben" und "aufheben" trennt.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  licensedSeats?: number | null;
}

class ToggleModuleDto {
  @IsBoolean()
  enabled!: boolean;
}

/**
 * Mandantenverwaltung des Betreibers.
 *
 * Liegt bewusst nicht hinter der Rolle `admin`: die gilt im jeweiligen Haus.
 * Wer hier schreibt, greift auf alle Häuser zu.
 */
@Controller("tenants")
@PlatformAdmin()
export class TenantsController {
  constructor(
    private readonly tenants: TenantService,
    private readonly modules: ModuleRegistryService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.tenants.list();
  }

  @Get(":id/kennzahlen")
  stats(@Param("id") id: string) {
    return this.tenants.stats(id);
  }

  @Post()
  async create(@Body() dto: CreateTenantDto, @CurrentUser() user: RequestUser) {
    const tenant = await this.tenants.create(dto);

    await this.audit.log({
      actor: user,
      action: "tenant.create",
      entityType: "tenant",
      entityId: tenant.id,
      detail: `Mandant "${tenant.name}" (${tenant.slug}) angelegt`,
    });

    return tenant;
  }

  /**
   * Abschalten statt Löschen: die Daten eines gekündigten Hauses müssen für
   * Aufbewahrungsfristen erreichbar bleiben, Anmeldungen aber sofort scheitern.
   */
  @Patch(":id/aktiv")
  async setActive(@Param("id") id: string, @Body() dto: SetActiveDto, @CurrentUser() user: RequestUser) {
    const tenant = await this.tenants.setActive(id, dto.isActive);

    await this.audit.log({
      actor: user,
      action: dto.isActive ? "tenant.activate" : "tenant.deactivate",
      entityType: "tenant",
      entityId: id,
      detail: `Mandant "${tenant.name}" ${dto.isActive ? "freigeschaltet" : "gesperrt"}`,
    });

    return tenant;
  }

  @Patch(":id/lizenz")
  async setLicense(@Param("id") id: string, @Body() dto: SetLicenseDto, @CurrentUser() user: RequestUser) {
    const tenant = await this.tenants.setLicense(id, dto.licensedSeats ?? null);

    await this.audit.log({
      actor: user,
      action: "tenant.license",
      entityType: "tenant",
      entityId: id,
      detail:
        tenant.licensedSeats === null
          ? `Lizenzkontingent für "${tenant.name}" aufgehoben`
          : `Lizenzkontingent für "${tenant.name}" auf ${tenant.licensedSeats} gesetzt`,
    });

    return tenant;
  }

  /**
   * Modulsteuerung eines fremden Hauses - die Plattformverwaltung hat dort
   * kein eigenes Konto. `runWithTenant` setzt für die Dauer des Aufrufs den
   * Kontext auf das gewählte Haus; `ModuleRegistryService` merkt davon nichts
   * und arbeitet wie immer auf "dem aktuellen Mandanten".
   */
  @Get(":id/module")
  async listModules(@Param("id") id: string) {
    const context = await this.tenants.context(id);
    if (!context) {
      throw new NotFoundException("Mandant nicht gefunden");
    }
    return runWithTenant(context, async () => await this.modules.list());
  }

  @Put(":id/module/:key")
  async setModule(
    @Param("id") id: string,
    @Param("key") key: string,
    @Body() dto: ToggleModuleDto,
    @CurrentUser() user: RequestUser,
  ) {
    const context = await this.tenants.context(id);
    if (!context) {
      throw new NotFoundException("Mandant nicht gefunden");
    }
    return runWithTenant(context, async () => await this.modules.setEnabled(key, dto.enabled, user));
  }
}
