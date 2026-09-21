/**
 * Ein Messpunkt der Systemlast, gespeichert und bei Bedarf mit Warnung.
 *
 * Läuft als eigener Prozess statt als Hintergrundaufgabe in der API - aus
 * demselben Grund wie der Aufbewahrungslauf: bei mehreren API-Instanzen liefe
 * eine eingebaute Zeitsteuerung mehrfach. Aufruf per Cron, z. B. minütlich:
 *
 *   * * * * *  cd /opt/ah-intranet/apps/api && node dist/scripts/monitoring.js
 *
 * Setzt `SMTP_HOST`/`SMTP_FROM` (siehe `core/mailer.ts`) und eine hinterlegte
 * Empfängeradresse voraus (Verwaltung → Monitoring) - ohne beides wird nur
 * gemessen und gespeichert, keine Warnung verschickt.
 */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { SystemMonitorService } from "../core/system-monitor.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });

  try {
    const monitor = app.get(SystemMonitorService);
    const sample = await monitor.erfassenUndPruefen();
    console.log(
      `Last ${sample.loadAvg1.toFixed(2)} · CPU ${sample.cpuPercent.toFixed(0)}% · RAM ${sample.memPercent.toFixed(
        0,
      )}% · Platte ${sample.diskPercent.toFixed(0)}%`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error("Messung fehlgeschlagen:", error);
  process.exit(1);
});
