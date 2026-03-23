import { Controller, Get } from "@nestjs/common";
import { tickets } from "@ah-intranet/shared";

@Controller("tickets")
export class TicketsController {
  @Get()
  findAll() {
    return tickets;
  }
}
