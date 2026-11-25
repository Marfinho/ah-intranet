import { Module } from "@nestjs/common";
import { HaeuserModule } from "../haeuser/haeuser.module";
import { InteressentenModule } from "../interessenten/interessenten.module";
import { StatistikController } from "./statistik.controller";
import { StatistikService } from "./statistik.service";

@Module({
  imports: [HaeuserModule, InteressentenModule],
  controllers: [StatistikController],
  providers: [StatistikService],
  exports: [StatistikService],
})
export class StatistikModule {}
