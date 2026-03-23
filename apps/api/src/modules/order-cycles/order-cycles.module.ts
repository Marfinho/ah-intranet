import { Module } from "@nestjs/common";
import { OrderCyclesController } from "./order-cycles.controller";

@Module({
  controllers: [OrderCyclesController],
})
export class OrderCyclesModule {}
