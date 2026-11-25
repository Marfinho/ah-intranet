import { Controller, Get, HttpCode, Res } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Response } from "express";
import { DatenbankService } from "./core/datenbank";
import { Public } from "./core/decorators";
import { IntranetService } from "./core/intranet.service";

@Controller()
export class AppController {
  constructor(
    private readonly db: DatenbankService,
    private readonly intranet: IntranetService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get("health")
  async health(@Res({ passthrough: true }) antwort: Response) {
    const pruefe = async (arbeit: () => Promise<unknown>) => {
      const start = Date.now();
      try {
        await arbeit();
        return { ok: true, latencyMs: Date.now() - start };
      } catch {
        return { ok: false };
      }
    };
    const [eigene, haeuser] = await Promise.all([
      pruefe(() => this.db.$queryRaw`SELECT 1`),
      pruefe(() => this.intranet.abfrage("SELECT 1")),
    ]);
    const ok = eigene.ok && haeuser.ok;
    antwort.status(ok ? 200 : 503);
    return {
      ok,
      service: "ahoi-verwaltung",
      uptimeSeconds: Math.round(process.uptime()),
      checks: { eigeneDaten: eigene, datenDerHaeuser: haeuser },
    };
  }

  @Public()
  @SkipThrottle()
  @Get("health/live")
  @HttpCode(200)
  live() {
    return { ok: true };
  }
}
