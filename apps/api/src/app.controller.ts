import { Controller, Get, HttpCode, Res } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Response } from "express";
import { AppService } from "./app.service";
import { Public } from "./core/decorators";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Schlägt mit HTTP 503 fehl, wenn eine Prüfung nicht durchgeht - sonst hält
   * der Orchestrator den Dienst für gesund und leitet weiter Verkehr darauf.
   */
  @Public()
  @SkipThrottle()
  @Get("health")
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const report = await this.appService.getHealth();
    response.status(report.ok ? 200 : 503);
    return report;
  }

  /** Schlanker Endpunkt für Startprüfungen: nur der Prozess, ohne Abhängigkeiten. */
  @Public()
  @SkipThrottle()
  @Get("health/live")
  @HttpCode(200)
  getLiveness() {
    return { ok: true };
  }
}
