import { Controller, Get } from "@nestjs/common";
import { adminSnapshot, allOrders, approvalTasks, newsItems } from "@ah-intranet/shared";
import { RequireRoles } from "../../common/roles.decorator";

@Controller("admin")
@RequireRoles("admin", "fachbereichsadmin")
export class AdminController {
  @Get("summary")
  summary() {
    return {
      ...adminSnapshot,
      newsItems,
      allOrders,
      approvalTasks,
    };
  }
}
