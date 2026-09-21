import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min, MinLength } from "class-validator";
import { AuditService } from "../../core/audit.service";
import { CurrentUser, PlatformAdmin } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";
import { TenantService } from "../../core/tenant.service";

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
}

class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

class SetLicenseDto {
  /** Leer/`null` heißt unbegrenzt. */
  @IsOptional()
  @IsInt()
  @Min(0)
  maxLocations?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxUsers?: number | null;
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
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.tenants.list();
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

  /**
   * Lizenzgrenzen des Hauses: höchstens so viele Standorte und Benutzerkonten.
   * Das Haus selbst legt innerhalb dieser Grenze frei Standorte, Abteilungen
   * und Mitarbeitende an - siehe `PeopleController`.
   */
  @Patch(":id/lizenz")
  async setLicense(@Param("id") id: string, @Body() dto: SetLicenseDto, @CurrentUser() user: RequestUser) {
    const tenant = await this.tenants.setLicense(id, dto);

    await this.audit.log({
      actor: user,
      action: "tenant.license",
      entityType: "tenant",
      entityId: id,
      detail: `Lizenz von "${tenant.name}" gesetzt: Standorte ${tenant.maxLocations ?? "unbegrenzt"}, Konten ${
        tenant.maxUsers ?? "unbegrenzt"
      }`,
    });

    return tenant;
  }
}
