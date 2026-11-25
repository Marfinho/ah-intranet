import { Module } from "@nestjs/common";
import { InteressentenController } from "./interessenten.controller";
import { InteressentenService } from "./interessenten.service";

@Module({ controllers: [InteressentenController], providers: [InteressentenService], exports: [InteressentenService] })
export class InteressentenModule {}
