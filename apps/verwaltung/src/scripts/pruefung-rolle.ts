import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { IntranetService } from "../core/intranet.service";
import { HaeuserService } from "../modules/haeuser/haeuser.service";
import { HausAnlegenService } from "../modules/haeuser/haus-anlegen.service";
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
  // Häuser entstehen nur über die Funktion, nie durch direkte Eingriffe in die Struktur.
  'INSERT INTO "User" (id, "tenantId", username, "passwordHash", "firstName", "lastName", "updatedAt") SELECT \'x\', id, \'x\', \'x\', \'x\', \'x\', now() FROM "Tenant" LIMIT 1',
  "INSERT INTO \"Role\" (id, \"tenantId\", key, name, description, \"updatedAt\") SELECT 'x', id, 'x', 'x', 'x', now() FROM \"Tenant\" LIMIT 1",
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
  // Haus anlegen über die Datenbankfunktion - nur auf Wunsch, denn es bleibt ein Haus zurück
  // (die Rolle darf nichts löschen). Die CI läuft gegen eine Wegwerf-Datenbank.
  if (process.env.PRUEFUNG_HAUS_ANLEGEN === "1") {
    const slug = `pruefung-${Date.now().toString(36)}`;
    try {
      const haus = await app
        .get(HausAnlegenService)
        .anlegen(
          { id: "", username: "pruefung", displayName: "Prüfung", rolle: "inhaber" },
          { slug, name: "Prüfhaus", adminUsername: "admin", adminPassword: "Pruefung-12345" },
        );
      const anzahl = await intranet.eine<{ n: number }>(
        `SELECT (SELECT count(*) FROM "Location" WHERE "tenantId" = $1)::int AS n`,
        [haus.tenantId],
      );
      if (anzahl?.n !== 1) {
        console.error("FEHLER: das angelegte Haus hat keinen Standort");
        fehler++;
      }
      // Die Funktion legt nur neue Häuser an: eine bestehende Kennung muss scheitern.
      await app
        .get(HausAnlegenService)
        .anlegen(
          { id: "", username: "pruefung", displayName: "Prüfung", rolle: "inhaber" },
          { slug, name: "Doppelt", adminUsername: "admin", adminPassword: "Pruefung-12345" },
        )
        .then(
          () => {
            console.error("FEHLER: doppelte Kennung wurde angelegt");
            fehler++;
          },
          () => undefined,
        );
    } catch (e) {
      console.error(`FEHLER: Haus anlegen mit der eingeschränkten Rolle: ${(e as Error).message}`);
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
