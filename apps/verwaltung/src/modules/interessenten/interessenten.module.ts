import { Module } from "@nestjs/common";
import { HaeuserModule } from "../haeuser/haeuser.module";
import { InteressentenController } from "./interessenten.controller";
import { InteressentenService } from "./interessenten.service";

@Module({
  imports: [HaeuserModule],
  controllers: [InteressentenController],
  providers: [InteressentenService],
  exports: [InteressentenService],
})
export class InteressentenModule {}
