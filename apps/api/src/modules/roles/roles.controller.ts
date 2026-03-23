import { Controller, Get } from "@nestjs/common";
import { roles } from "@ah-intranet/shared";

@Controller("roles")
export class RolesController {
  @Get()
  findAll() {
    return roles;
  }
}
