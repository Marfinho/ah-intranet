import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { StatistikService } from "../modules/statistik/statistik.service";

/**
 * Hält den heutigen Stand der Kennzahlen fest (Cron, einmal täglich). Wie bei der
 * Aufbewahrung kein Hintergrundjob in der Anwendung: bei mehreren Instanzen
 * liefe er sonst mehrfach.
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  const ergebnis = await app.get(StatistikService).schnappschuss();
  console.log(`Schnappschuss ${ergebnis.tag}: ${ergebnis.haeuser} Häuser`);
  await app.close();
}

void main();
