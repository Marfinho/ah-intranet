import { Body, Controller, Get, Patch, Query } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { PlatformService } from "./platform.service";
import { CurrentUser, Feature, Permission } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

class UpdateTenantProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly platform: PlatformService) {}

  @Get()
  dashboard(@CurrentUser() user: RequestUser) {
    return this.platform.dashboard(user);
  }
}

@Controller("search")
@Feature("search")
export class SearchController {
  constructor(private readonly platform: PlatformService) {}

  @Get()
  search(@CurrentUser() user: RequestUser, @Query("q") q = "") {
    return this.platform.search(user, q);
  }
}

@Controller("admin")
export class AdminController {
  constructor(private readonly platform: PlatformService) {}

  @Get("summary")
  @Permission("admin.access")
  summary() {
    return this.platform.adminSummary();
  }

  /** Eigenes Mandantenprofil - nicht zu verwechseln mit der Mandantenverwaltung des Betreibers. */
  @Patch("mandant")
  @Permission("tenant.manage")
  updateTenant(@CurrentUser() user: RequestUser, @Body() dto: UpdateTenantProfileDto) {
    return this.platform.updateOwnTenant(user, dto);
  }
}

@Controller("audit")
@Feature("audit")
export class AuditController {
  constructor(private readonly platform: PlatformService) {}

  @Get()
  @Permission("audit.read")
  list(@Query("search") search?: string, @Query("action") action?: string) {
    return this.platform.auditLog({ search, action });
  }
}
