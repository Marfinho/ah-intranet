import { Controller, Get } from "@nestjs/common";
import { employeeDirectory } from "@ah-intranet/shared";

@Controller("directory")
export class DirectoryController {
  @Get()
  findAll() {
    return employeeDirectory;
  }
}
