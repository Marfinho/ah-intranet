import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import { IsBoolean } from "class-validator";
import { ModuleRegistryService } from "../../core/module-registry.service";
import { CurrentUser, Permission, Roles } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

class ToggleModuleDto {
  @IsBoolean()
  enabled!: boolean;
}

@Controller("modules")
export class ModulesController {
  constructor(private readonly modules: ModuleRegistryService) {}

  /**
   * Zustand aller Module. Jede angemeldete Person darf das lesen, weil das
   * Frontend daraus Navigation und Routen aufbaut.
   */
  @Get()
  list() {
    return this.modules.list();
  }

  @Put(":key")
  @Roles("admin")
  @Permission("modules.manage")
  setEnabled(@Param("key") key: string, @Body() dto: ToggleModuleDto, @CurrentUser() user: RequestUser) {
    return this.modules.setEnabled(key, dto.enabled, user);
  }

  @Post("reset")
  @Roles("admin")
  @Permission("modules.manage")
  reset(@CurrentUser() user: RequestUser) {
    return this.modules.resetToDefaults(user);
  }
}
