import { Controller, Get, Query } from "@nestjs/common";
import { PlatformService } from "./platform.service";
import { CurrentUser, Feature, Permission, Roles } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

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
  @Roles("admin", "fachbereichsadmin")
  summary() {
    return this.platform.adminSummary();
  }
}

@Controller("audit")
@Feature("audit")
export class AuditController {
  constructor(private readonly platform: PlatformService) {}

  @Get()
  @Roles("admin")
  @Permission("audit.read")
  list(@Query("search") search?: string, @Query("action") action?: string) {
    return this.platform.auditLog({ search, action });
  }
}
