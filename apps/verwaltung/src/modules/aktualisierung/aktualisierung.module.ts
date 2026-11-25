import { Module } from "@nestjs/common";
import { AktualisierungController } from "./aktualisierung.controller";
import { AktualisierungService } from "./aktualisierung.service";
import { GithubService } from "./github.service";

@Module({ controllers: [AktualisierungController], providers: [AktualisierungService, GithubService] })
export class AktualisierungModule {}
