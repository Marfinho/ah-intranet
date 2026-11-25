import { Module } from "@nestjs/common";
import { HaeuserController } from "./haeuser.controller";
import { HausAnlegenService } from "./haus-anlegen.service";
import { HaeuserService } from "./haeuser.service";

@Module({
  controllers: [HaeuserController],
  providers: [HaeuserService, HausAnlegenService],
  exports: [HaeuserService, HausAnlegenService],
})
export class HaeuserModule {}
