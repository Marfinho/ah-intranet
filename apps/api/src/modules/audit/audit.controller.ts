import { Controller, Get } from "@nestjs/common";
import { RequireRoles } from "../../common/roles.decorator";
import { AuditService } from "./audit.service";

@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequireRoles("admin")
  findAll() {
    return this.auditService.findAll();
  }
}
