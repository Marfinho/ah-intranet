import { Module } from "@nestjs/common";
import { CalendarController, RoomsController } from "./resources.controller";
import { OutlookCalendarService } from "./outlook-calendar.service";
import { ResourcesService } from "./resources.service";

@Module({
  controllers: [CalendarController, RoomsController],
  providers: [ResourcesService, OutlookCalendarService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
