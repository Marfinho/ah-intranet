import { Module } from "@nestjs/common";
import { EinrichtungController } from "./einrichtung.controller";
import { EinrichtungService } from "./einrichtung.service";

@Module({
  controllers: [EinrichtungController],
  providers: [EinrichtungService],
  exports: [EinrichtungService],
})
export class EinrichtungModule {}
