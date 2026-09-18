import { Module } from "@nestjs/common";
import { IdeasController, PollsController, TicketsController } from "./servicedesk.controller";
import { ServiceDeskService } from "./servicedesk.service";

@Module({
  controllers: [TicketsController, IdeasController, PollsController],
  providers: [ServiceDeskService],
  exports: [ServiceDeskService],
})
export class ServiceDeskModule {}
