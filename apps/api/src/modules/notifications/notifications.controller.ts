import { Controller, Get } from "@nestjs/common";
import { notifications } from "@ah-intranet/shared";

@Controller("notifications")
export class NotificationsController {
  @Get()
  findAll() {
    return notifications;
  }
}
