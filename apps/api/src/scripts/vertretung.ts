/**
 * Tageslauf: Vertretungen über laufende Abwesenheiten informieren.
 *
 * Gebraucht für die Einstellung „Am ersten Tag": der Eintrag liegt Wochen vor
 * dem Urlaub, die Mail soll aber erst am ersten Tag kommen. Auch bei „Sofort"
 * schadet der Lauf nicht - er holt nach, was beim Eintrag nicht ging. Ein Merker
 * an der Abwesenheit verhindert doppelte Meldungen.
 *
 * Läuft als eigener Prozess aus demselben Grund wie die Aufbewahrung: bei
 * mehreren API-Instanzen liefe eine eingebaute Zeitsteuerung mehrfach. Per Cron:
 *
 *   30 6 * * *  cd /opt/ah-intranet/apps/api && node dist/scripts/vertretung.js
 */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { SchluesselService } from "../modules/people/schluessel.service";
import { TenantService } from "../core/tenant.service";
import { runWithTenant } from "../core/tenant-context";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });

  try {
    const schluessel = app.get(SchluesselService);
    const tenants = await app.get(TenantService).list();
    let gesamt = 0;

    for (const tenant of tenants) {
      // Gesperrte Häuser überspringen: dort meldet sich niemand an, eine Mail wäre Lärm.
      if (!tenant.isActive) {
        continue;
      }
      const gemeldet = await runWithTenant({ tenantId: tenant.id, slug: tenant.slug }, async () => {
        return await schluessel.meldeFaellige();
      });
      gesamt += gemeldet;
      console.log(`${tenant.name} (${tenant.slug}): ${gemeldet} Abwesenheit(en) gemeldet`);
    }

    console.log(`${gesamt} Abwesenheit(en) gemeldet.`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error("Vertretungslauf fehlgeschlagen:", error);
  process.exit(1);
});
