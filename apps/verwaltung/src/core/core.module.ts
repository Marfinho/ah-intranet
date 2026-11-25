import { Global, Module } from "@nestjs/common";
import { DatenbankService } from "./datenbank";
import { IntranetService } from "./intranet.service";
import { ProtokollService } from "./protokoll.service";

@Global()
@Module({
  providers: [DatenbankService, IntranetService, ProtokollService],
  exports: [DatenbankService, IntranetService, ProtokollService],
})
export class CoreModule {}
