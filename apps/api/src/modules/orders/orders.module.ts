import { Module } from "@nestjs/common";
import { ApprovalsController, OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  controllers: [OrdersController, ApprovalsController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
