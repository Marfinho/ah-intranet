import { Module } from "@nestjs/common";
import { SupportTicketsController } from "./support-tickets.controller";
import { SupportTicketsService } from "./support-tickets.service";
import { PlatformSupportController } from "./platform-support.controller";
import { PlatformSupportService } from "./platform-support.service";
import { PlatformStaffController } from "./platform-staff.controller";
import { PlatformStaffService } from "./platform-staff.service";

@Module({
  controllers: [SupportTicketsController, PlatformSupportController, PlatformStaffController],
  providers: [SupportTicketsService, PlatformSupportService, PlatformStaffService],
})
export class SupportModule {}
