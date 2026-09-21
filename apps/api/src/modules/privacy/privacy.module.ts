import { Module } from "@nestjs/common";
import { PrivacyController, SelbstauskunftController } from "./privacy.controller";
import { PrivacyService } from "./privacy.service";

@Module({
  controllers: [PrivacyController, SelbstauskunftController],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
