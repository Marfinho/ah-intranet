import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { CoreModule } from "./core/core.module";
import { SitzungsGuard } from "./modules/auth/auth.guard";
import { AktualisierungModule } from "./modules/aktualisierung/aktualisierung.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HaeuserModule } from "./modules/haeuser/haeuser.module";
import { InteressentenModule } from "./modules/interessenten/interessenten.module";
import { ProtokollModule } from "./modules/protokoll/protokoll.controller";
import { StatistikModule } from "./modules/statistik/statistik.module";
import { SystemModule } from "./modules/system/system.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 300 }]),
    CoreModule,
    AuthModule,
    HaeuserModule,
    InteressentenModule,
    StatistikModule,
    SystemModule,
    ProtokollModule,
    AktualisierungModule,
  ],
  controllers: [AppController],
  // Erst drosseln, dann anmelden - die Sitzungsprüfung selbst steckt im AuthModule.
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SitzungsGuard },
  ],
})
export class AppModule {}
