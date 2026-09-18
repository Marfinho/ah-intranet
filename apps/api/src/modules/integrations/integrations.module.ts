import { Module } from "@nestjs/common";
import { IntegrationsController, VehicleListingsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";
import { IntegrationCryptoService } from "./crypto.service";
import { MobileDeAdapter } from "./adapters/mobile-de.adapter";
import { DmsFileAdapter } from "./adapters/dms-file.adapter";
import { DatevAdapter } from "./adapters/datev.adapter";
import { PortalLinkAdapter } from "./adapters/portal.adapter";

@Module({
  controllers: [IntegrationsController, VehicleListingsController],
  providers: [
    IntegrationsService,
    IntegrationCryptoService,
    MobileDeAdapter,
    DmsFileAdapter,
    DatevAdapter,
    PortalLinkAdapter,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
