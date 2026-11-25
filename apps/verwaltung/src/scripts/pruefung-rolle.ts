import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { IntranetService } from "../core/intranet.service";
import { HaeuserService } from "../modules/haeuser/haeuser.service";
import { InteressentenService } from "../modules/interessenten/interessenten.service";
import { StatistikService } from "../modules/statistik/statistik.service";
import { SystemService } from "../modules/system/system.service";

/**
 * Prüft gegen eine echte Datenbank, dass die Verwaltung mit ihrer
 * eingeschränkten Rolle (scripts/verwaltung-rolle.sql) zweierlei leistet:
 *
 * 1. Jede Auswertung läuft durch - fehlt der Rolle ein Recht auf eine neu
 *    benutzte Spalte, fällt das hier auf und nicht erst im Betrieb.
 * 2. Personenbezogene Spalten bleiben unlesbar - die Zusicherung, dass die
 *    Verwaltung nur Zahlen sieht, hängt an der Datenbank, nicht am Programmcode.
 *
 * Aufruf: INTRANET_DATABASE_URL zeigt auf die Rolle `ahoi_verwaltung`.
 */
const VERBOTEN = [
  'SELECT username FROM "User" LIMIT 1',
  'SELECT "passwordHash" FROM "User" LIMIT 1',
  'SELECT email FROM "User" LIMIT 1',
  'SELECT "firstName" FROM "User" LIMIT 1',
  'SELECT "tokenHash" FROM "Lead" LIMIT 1',
  'SELECT logo FROM "Tenant" LIMIT 1',
  'SELECT "actorUsername" FROM "AuditLog" LIMIT 1',
  'SELECT detail FROM "AuditLog" LIMIT 1',
  'SELECT title FROM "Ticket" LIMIT 1',
  'SELECT type FROM "Absence" LIMIT 1',
  'DELETE FROM "Tenant"',
  "UPDATE \"User\" SET status = 'inactive'",
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error"] });
  const intranet = app.get(IntranetService);
  let fehler = 0;

  for (const sql of VERBOTEN) {
    try {
      await intranet.abfrage(sql);
      console.error(`FEHLER: erlaubt, obwohl verboten: ${sql}`);
      fehler++;
    } catch (e) {
      if (!/permission denied/i.test((e as Error).message)) {
        console.error(`FEHLER: unerwartete Antwort bei ${sql}: ${(e as Error).message}`);
        fehler++;
      }
    }
  }

  const proben: [string, () => Promise<unknown>][] = [
    ["Häuser", () => app.get(HaeuserService).liste()],
    ["Statistik", () => app.get(StatistikService).plattform()],
    ["Übersicht", () => app.get(StatistikService).uebersicht()],
    ["Interessenten", () => app.get(InteressentenService).liste()],
    ["Auswertung Interessenten", () => app.get(InteressentenService).auswertung()],
    ["System", () => app.get(SystemService).parameter()],
  ];
  for (const [name, lauf] of proben) {
    try {
      await lauf();
    } catch (e) {
      console.error(`FEHLER: ${name} läuft mit der eingeschränkten Rolle nicht: ${(e as Error).message}`);
      fehler++;
    }
  }
  // Ein Haus im Detail, falls eines da ist.
  const haeuser = await app.get(HaeuserService).liste();
  if (haeuser[0]) {
    await app
      .get(HaeuserService)
      .detail(haeuser[0].id)
      .catch((e: Error) => {
        console.error(`FEHLER: Hausdetail: ${e.message}`);
        fehler++;
      });
  }

  await app.close();
  if (fehler > 0) {
    process.exit(1);
  }
  console.log(
    `Rolle der Verwaltung geprüft: ${VERBOTEN.length} Zugriffe verwehrt, ${proben.length + 1} Auswertungen laufen.`,
  );
}

void main();
