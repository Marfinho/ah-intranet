import { execFile } from "node:child_process";
import * as os from "node:os";
import { promisify } from "node:util";
import { Injectable, Logger } from "@nestjs/common";
import type { PlatformMonitoringPayload, SystemMetricSampleDto } from "@ah-intranet/shared";
import { PrismaService } from "./prisma.service";
import { MailerService } from "./mailer";
import { abstandEingehalten, schwellenUeberschreitungen } from "./system-monitor-regeln";

const execFileAsync = promisify(execFile);

/** Nach 30 Tagen ist ein Messpunkt für die Anzeige uninteressant. */
const AUFBEWAHRUNG_TAGE = 30;

/**
 * Beobachtet die Maschine, auf der AHOI läuft - CPU, Arbeitsspeicher,
 * Plattenplatz - und meldet per E-Mail, wenn eine Schwelle überschritten ist.
 *
 * Bewusst kein Fachmodul: die Last der Maschine ist Sache des Betriebs, nicht
 * eines Hauses, und läuft deshalb über die globalen Modelle `SystemMetricSample`
 * und `PlatformSettings` (siehe `tenant-isolation.ts`).
 *
 * Misst mit Bordmitteln des Betriebssystems (`os`-Modul, `df`) statt eines
 * externen Systems - für eine einzelne Maschine reicht das, und es kommt ohne
 * zusätzliche Abhängigkeit oder Zugangsdaten aus. Eine zentrale Überwachung
 * mehrerer Maschinen bräuchte mehr; das steht in `docs/plattform.md` als
 * offener Punkt.
 */
@Injectable()
export class SystemMonitorService {
  private readonly logger = new Logger(SystemMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  /** Momentaufnahme, ohne etwas zu speichern. */
  async messen(): Promise<{ loadAvg1: number; cpuPercent: number; memPercent: number; diskPercent: number }> {
    const [load1] = os.loadavg();
    const kerne = Math.max(os.cpus().length, 1);
    const cpuPercent = Math.min(100, (load1 / kerne) * 100);

    const memPercent = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
    const diskPercent = await this.diskBelegung();

    return { loadAvg1: load1, cpuPercent, memPercent, diskPercent };
  }

  /**
   * Plattenplatz des Wurzeldateisystems über `df` - Node bietet dafür keine
   * eingebaute Abfrage. Schlägt der Aufruf fehl (z. B. auf einem System ohne
   * `df`), wird das geloggt und `0` gemeldet statt eines geratenen Wertes.
   */
  private async diskBelegung(): Promise<number> {
    try {
      const { stdout } = await execFileAsync("df", ["-Pk", "/"]);
      const zeile = stdout.trim().split("\n").at(-1) ?? "";
      const spalten = zeile.split(/\s+/);
      const genutztProzent = spalten[4]?.replace("%", "");
      const wert = genutztProzent ? Number(genutztProzent) : NaN;
      return Number.isFinite(wert) ? wert : 0;
    } catch (error) {
      this.logger.warn(`Plattenbelegung konnte nicht ermittelt werden: ${(error as Error).message}`);
      return 0;
    }
  }

  /** Aktuelle Einstellungen, mit den Voreinstellungen aus dem Schema als Startzustand. */
  async einstellungen() {
    return this.prisma.platformSettings.upsert({
      where: { id: "global" },
      create: { id: "global" },
      update: {},
    });
  }

  async einstellungenSetzen(input: {
    alertEmail?: string | null;
    cpuThresholdPercent?: number;
    memThresholdPercent?: number;
    diskThresholdPercent?: number;
    cooldownMinutes?: number;
  }) {
    return this.prisma.platformSettings.upsert({
      where: { id: "global" },
      create: { id: "global", ...input },
      update: input,
    });
  }

  /**
   * Nimmt einen Messpunkt, speichert ihn, räumt alte auf und verschickt bei
   * Bedarf eine Warnung. Für den Cron-Lauf gedacht (`scripts/monitoring.ts`),
   * aber auch von der Verwaltungsoberfläche für einen manuellen Test nutzbar.
   */
  async erfassenUndPruefen(): Promise<SystemMetricSampleDto> {
    const messung = await this.messen();
    const sample = await this.prisma.systemMetricSample.create({ data: messung });

    await this.prisma.systemMetricSample.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - AUFBEWAHRUNG_TAGE * 24 * 60 * 60 * 1000) } },
    });

    await this.pruefenUndWarnen(messung);

    return { ...sample, createdAt: sample.createdAt.toISOString() };
  }

  private async pruefenUndWarnen(messung: {
    cpuPercent: number;
    memPercent: number;
    diskPercent: number;
  }): Promise<void> {
    const settings = await this.einstellungen();
    if (!settings.alertEmail) {
      return;
    }

    const ueberschritten = schwellenUeberschreitungen(messung, settings);
    if (ueberschritten.length === 0) {
      return;
    }

    if (!abstandEingehalten(settings.lastAlertAt, settings.cooldownMinutes, new Date())) {
      return;
    }

    const versendet = await this.mailer.send({
      to: settings.alertEmail,
      subject: "AHOI: Systemlast über Schwelle",
      text: `Auf dem Server läuft AHOI unter erhöhter Last:\n\n- ${ueberschritten.join(
        "\n- ",
      )}\n\nNächste Warnung frühestens nach ${settings.cooldownMinutes} Minuten, solange die Last anhält.`,
    });

    if (versendet) {
      await this.prisma.platformSettings.update({ where: { id: "global" }, data: { lastAlertAt: new Date() } });
    }
  }

  async verlauf(nehmen = 200): Promise<PlatformMonitoringPayload> {
    const [history, settings] = await Promise.all([
      this.prisma.systemMetricSample.findMany({ orderBy: { createdAt: "desc" }, take: nehmen }),
      this.einstellungen(),
    ]);

    return {
      current: history[0] ? { ...history[0], createdAt: history[0].createdAt.toISOString() } : null,
      history: history.map((eintrag) => ({ ...eintrag, createdAt: eintrag.createdAt.toISOString() })).reverse(),
      settings: {
        alertEmail: settings.alertEmail,
        cpuThresholdPercent: settings.cpuThresholdPercent,
        memThresholdPercent: settings.memThresholdPercent,
        diskThresholdPercent: settings.diskThresholdPercent,
        cooldownMinutes: settings.cooldownMinutes,
        lastAlertAt: settings.lastAlertAt?.toISOString() ?? null,
      },
    };
  }
}
