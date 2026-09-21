import { Body, Controller, Get, Put, Param, Query } from "@nestjs/common";
import { ArrayUnique, IsArray, IsString } from "class-validator";
import { PlatformStaffService } from "./platform-staff.service";
import { CurrentUser, PlatformAdmin } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

class SetPlatformPermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}

/**
 * Mitarbeiterverwaltung der Plattform: wer außerhalb der eigenen Adminrolle
 * eines Hauses Rechte des Betreibers trägt, und welche.
 *
 * Bewusst vollständig dem Betreiber vorbehalten (`@PlatformAdmin()`), auch das
 * Lesen: wer Plattformrechte vergeben darf, ist dieselbe Entscheidung wie das
 * Anlegen eines Hauses und lässt sich aus denselben Gründen nicht
 * weiterreichen - sonst könnte sich ein einzelnes Haus über eine gewährte
 * Berechtigung selbst mehr Rechte verschaffen, als der Betreiber vorgesehen hat.
 */
@Controller("plattform/mitarbeiter")
@PlatformAdmin()
export class PlatformStaffController {
  constructor(private readonly staff: PlatformStaffService) {}

  @Get()
  list() {
    return this.staff.list();
  }

  @Get("suche")
  search(@Query("q") q = "") {
    return this.staff.search(q);
  }

  @Put(":userId/rechte")
  setPermissions(
    @CurrentUser() user: RequestUser,
    @Param("userId") userId: string,
    @Body() dto: SetPlatformPermissionsDto,
  ) {
    return this.staff.setPermissions(user, userId, dto.permissions);
  }
}
