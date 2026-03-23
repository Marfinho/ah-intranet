import { Controller, Get } from "@nestjs/common";
import { users } from "@ah-intranet/shared";

@Controller("users")
export class UsersController {
  @Get()
  findAll() {
    return users;
  }
}
