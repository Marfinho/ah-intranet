import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import { IsEmail, IsInt, IsOptional, Max, Min } from "class-validator";
import { AuditService } from "../../core/audit.service";
import { CurrentUser, PlatformAdmin } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";
import { SystemMonitorService } from "../../core/system-monitor.service";

class SettingsDto {
  /** Leer heißt: keine Warnungen verschicken. */
  @IsOptional()
  @IsEmail({}, { message: "Bitte eine gültige E-Mail-Adresse angeben" })
  alertEmail?: string;

  @IsOptional() @IsInt() @Min(1) @Max(100) cpuThresholdPercent?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) memThresholdPercent?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) diskThresholdPercent?: number;
  @IsOptional() @IsInt() @Min(5) cooldownMinutes?: number;
}

/**
 * Systemlast der Maschine, auf der AHOI läuft, und das Warnsystem dazu.
 *
 * Liegt wie die Mandantenverwaltung außerhalb der Rolle `admin` eines Hauses -
 * die Last der Maschine geht kein einzelnes Autohaus etwas an.
 */
@Controller("monitoring")
@PlatformAdmin()
export class MonitoringController {
  constructor(
    private readonly monitor: SystemMonitorService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  verlauf() {
    return this.monitor.verlauf();
  }

  /** Sofortige Messung, z. B. für einen Test des Warnsystems. */
  @Post("messen")
  messen() {
    return this.monitor.erfassenUndPruefen();
  }

  @Patch("einstellungen")
  async einstellungenSetzen(@Body() dto: SettingsDto, @CurrentUser() user: RequestUser) {
    // Ein fehlendes Feld lässt den bisherigen Wert unverändert - die
    // Oberfläche schickt nur, was sich geändert hat, siehe `actions.ts`.
    const settings = await this.monitor.einstellungenSetzen(dto);

    await this.audit.log({
      actor: user,
      action: "monitoring.settings",
      entityType: "platform-settings",
      entityId: "global",
      detail: `Warnsystem aktualisiert: Empfänger ${settings.alertEmail ?? "keiner"}, Schwellen CPU ${
        settings.cpuThresholdPercent
      }% / RAM ${settings.memThresholdPercent}% / Platte ${settings.diskThresholdPercent}%`,
    });

    return settings;
  }
}
