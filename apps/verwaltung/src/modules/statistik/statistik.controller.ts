import { Controller, Get, Post, Query } from "@nestjs/common";
import { Aktuell, Schreibend, type Sitzung } from "../../core/decorators";
import { ProtokollService } from "../../core/protokoll.service";
import { StatistikService } from "./statistik.service";

@Controller()
export class StatistikController {
  constructor(
    private readonly statistik: StatistikService,
    private readonly protokoll: ProtokollService,
  ) {}

  @Get("uebersicht") uebersicht() {
    return this.statistik.uebersicht();
  }
  @Get("statistik") plattform() {
    return this.statistik.plattform();
  }
  @Get("statistik/verlauf") verlauf(@Query("bereich") bereich?: string) {
    return this.statistik.verlauf(bereich || "plattform");
  }

  @Post("statistik/schnappschuss")
  @Schreibend()
  async schnappschuss(@Aktuell() wer: Sitzung) {
    const ergebnis = await this.statistik.schnappschuss();
    await this.protokoll.schreibe(
      wer,
      "statistik.schnappschuss",
      "statistik",
      ergebnis.tag,
      `Kennzahlen für ${ergebnis.haeuser} Häuser festgehalten`,
    );
    return ergebnis;
  }
}
