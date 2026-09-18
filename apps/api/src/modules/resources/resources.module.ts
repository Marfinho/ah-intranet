import { Module } from "@nestjs/common";
import { CalendarController, RoomsController, VehiclesController } from "./resources.controller";
import { ResourcesService } from "./resources.service";

@Module({
  controllers: [CalendarController, RoomsController, VehiclesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
