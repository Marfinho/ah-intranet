import { Body, Controller, Get, Param, Post, Put, Query, Res } from "@nestjs/common";
import { IsBoolean, IsObject, IsOptional } from "class-validator";
import type { Response } from "express";
import { IntegrationsService } from "./integrations.service";
import { toDatevBuffer } from "./adapters/datev.builder";
import { CurrentUser, Feature, Roles } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

class ConnectorConfigDto {
  @IsOptional() @IsObject() settings?: Record<string, string>;
  @IsOptional() @IsObject() secrets?: Record<string, string>;
}

class ToggleDto {
  @IsBoolean() enabled!: boolean;
}

@Controller("integrations")
@Feature("integrations")
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get("connectors")
  @Roles("admin")
  list() {
    return this.integrations.list();
  }

  @Get("connectors/:key")
  @Roles("admin")
  detail(@Param("key") key: string) {
    return this.integrations.detail(key);
  }

  @Put("connectors/:key")
  @Roles("admin")
  save(@Param("key") key: string, @Body() dto: ConnectorConfigDto, @CurrentUser() user: RequestUser) {
    return this.integrations.saveConfig(
      key,
      { settings: dto.settings ?? {}, secrets: dto.secrets ?? {} },
      user,
    );
  }

  @Put("connectors/:key/enabled")
  @Roles("admin")
  setEnabled(@Param("key") key: string, @Body() dto: ToggleDto, @CurrentUser() user: RequestUser) {
    return this.integrations.setEnabled(key, dto.enabled, user);
  }

  @Post("connectors/:key/check")
  @Roles("admin")
  check(@Param("key") key: string, @CurrentUser() user: RequestUser) {
    return this.integrations.check(key, user);
  }

  @Post("connectors/:key/run/:capability")
  @Roles("admin")
  run(@Param("key") key: string, @Param("capability") capability: string, @CurrentUser() user: RequestUser) {
    return this.integrations.run(key, capability, user);
  }

  @Get("runs")
  @Roles("admin")
  runs(@Query("connector") connector?: string) {
    return this.integrations.runs({ connectorKey: connector });
  }

  /** Buchungsstapel zum direkten Download, ohne Ablage im Dateisystem. */
  @Get("datev/export")
  @Roles("admin")
  async datevExport(@CurrentUser() user: RequestUser, @Res() response: Response) {
    const result = await this.integrations.datevPreview(user);
    const buffer = toDatevBuffer(result.content);

    response.setHeader("content-type", "text/csv; charset=windows-1252");
    response.setHeader("content-disposition", `attachment; filename="${result.fileName}"`);
    response.setHeader("x-booking-count", String(result.count));
    response.send(buffer);
  }
}

/** Der Fahrzeugbestand ist für alle Mitarbeitenden lesbar, nicht nur für Admins. */
@Controller("vehicle-listings")
@Feature("stock")
export class VehicleListingsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  list(@Query("search") search?: string, @Query("source") source?: string) {
    return this.integrations.listings({ search, source });
  }
}
