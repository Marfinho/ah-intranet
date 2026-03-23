import { Controller, Get } from "@nestjs/common";
import { calendarEvents } from "@ah-intranet/shared";

@Controller("calendar")
export class CalendarController {
  @Get()
  findAll() {
    return calendarEvents;
  }
}
