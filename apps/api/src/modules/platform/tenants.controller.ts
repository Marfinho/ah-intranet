import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { TENANT_LOGO_MAX_LENGTH } from "@ah-intranet/shared";
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

class SetLogoDto {
  /** `null` entfernt das Logo. Fehlt es ganz, bleibt das bisherige Logo unangetastet. */
  @IsOptional()
  @IsString()
  @MaxLength(TENANT_LOGO_MAX_LENGTH, { message: "Das Logo ist zu groß (maximal rund 200 KB)" })
  @Matches(/^data:image\/(png|jpeg|jpg|svg\+xml|webp);base64,/, {
    message: "Das Logo muss als PNG, JPEG, WebP oder SVG hochgeladen werden",
  })
  logoUrl?: string | null;
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
   * Tritt in der Kopfzeile des Hauses an die Stelle der Wortmarke "AHOI".
   * `logoUrl: null` nimmt das Logo zurück.
   */
  @Patch(":id/logo")
  async setLogo(@Param("id") id: string, @Body() dto: SetLogoDto, @CurrentUser() user: RequestUser) {
    const tenant = await this.tenants.setLogo(id, dto.logoUrl ?? null);

    await this.audit.log({
      actor: user,
      action: dto.logoUrl ? "tenant.logo.set" : "tenant.logo.clear",
      entityType: "tenant",
      entityId: id,
      detail: dto.logoUrl ? `Logo für "${tenant.name}" hinterlegt` : `Logo für "${tenant.name}" entfernt`,
    });

    return tenant;
  }
}
