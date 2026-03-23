import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { CreateBusinessCardOrderDto } from "./dto/create-business-card-order.dto";
import { CreateWorkwearOrderDto } from "./dto/create-workwear-order.dto";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get("overview")
  overview() {
    return this.ordersService.overview();
  }

  @Get("all")
  findAll() {
    return this.ordersService.findAll();
  }

  @Get("business-cards/config")
  businessCardConfig() {
    return this.ordersService.businessCardConfig();
  }

  @Get("business-cards/:id")
  businessCardDetail(@Param("id") id: string) {
    return this.ordersService.businessCardDetail(id);
  }

  @Post("business-cards")
  createBusinessCardOrder(@Body() dto: CreateBusinessCardOrderDto) {
    return this.ordersService.createBusinessCardOrder(dto);
  }

  @Get("workwear/catalog")
  workwearCatalog() {
    return this.ordersService.workwearCatalog();
  }

  @Get("workwear/:id")
  workwearDetail(@Param("id") id: string) {
    return this.ordersService.workwearDetail(id);
  }

  @Post("workwear")
  createWorkwearOrder(@Body() dto: CreateWorkwearOrderDto) {
    return this.ordersService.createWorkwearOrder(dto);
  }
}
