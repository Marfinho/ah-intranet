import { Controller, Get, Module, Query } from "@nestjs/common";
import { DatenbankService } from "../../core/datenbank";

@Controller("protokoll")
export class ProtokollController {
  constructor(private readonly db: DatenbankService) {}

  @Get()
  liste(@Query("suche") suche?: string) {
    return this.db.protokoll.findMany({
      where: suche
        ? {
            OR: [
              { detail: { contains: suche, mode: "insensitive" } },
              { aktion: { contains: suche } },
              { betreiberName: { contains: suche, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}

@Module({ controllers: [ProtokollController] })
export class ProtokollModule {}
