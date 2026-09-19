import { Module } from "@nestjs/common";
import { CalendarController, RoomsController } from "./resources.controller";
import { ResourcesService } from "./resources.service";

@Module({
  controllers: [CalendarController, RoomsController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
