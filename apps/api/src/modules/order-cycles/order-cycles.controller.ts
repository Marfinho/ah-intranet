import { Controller, Get } from "@nestjs/common";
import { orderCycles } from "@ah-intranet/shared";

@Controller("order-cycles")
export class OrderCyclesController {
  @Get()
  findAll() {
    return orderCycles;
  }
}
