import { Module } from "@nestjs/common";
import { HaeuserController } from "./haeuser.controller";
import { HaeuserService } from "./haeuser.service";

@Module({ controllers: [HaeuserController], providers: [HaeuserService], exports: [HaeuserService] })
export class HaeuserModule {}
