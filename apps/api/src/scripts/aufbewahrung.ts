/**
 * Aufbewahrungslauf über alle Mandanten.
 *
 * Läuft bewusst als eigener Prozess statt als Hintergrundaufgabe in der API:
 * bei mehreren API-Instanzen liefe eine eingebaute Zeitsteuerung mehrfach, und
 * ein Löschlauf gehört dorthin, wo sein Ergebnis gesehen wird. Aufruf per Cron:
 *
 *   0 3 * * *  cd /opt/ah-intranet/apps/api && node dist/scripts/aufbewahrung.js
 *
 * Mit `--vorschau` wird nur gezählt, nichts gelöscht.
 */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { PrivacyService } from "../modules/privacy/privacy.service";
import { TenantService } from "../core/tenant.service";
import { runWithTenant } from "../core/tenant-context";

async function main() {
  const nurVorschau = process.argv.includes("--vorschau");
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });

  try {
    const privacy = app.get(PrivacyService);
    const tenants = await app.get(TenantService).list();
    let gesamt = 0;

    console.log(`${nurVorschau ? "Vorschau" : "Aufbewahrungslauf"} über ${tenants.length} Haus/Häuser\n`);

    for (const tenant of tenants) {
      // Jeder Mandant in seinem eigenen Kontext - die Prisma-Middleware filtert
      // daraufhin automatisch, der Lauf kann kein fremdes Haus treffen.
      const ergebnis = await runWithTenant({ tenantId: tenant.id, slug: tenant.slug }, () =>
        nurVorschau ? privacy.vorschau() : privacy.aufraeumen(null),
      );

      const summe = ergebnis.reduce((wert, eintrag) => wert + eintrag.entfernt, 0);
      gesamt += summe;

      console.log(`${tenant.name} (${tenant.slug})`);
      for (const eintrag of ergebnis) {
        const zeile = `${eintrag.entfernt}`.padStart(6);
        console.log(`  ${zeile}  ${eintrag.label} · älter als ${eintrag.days} Tage`);
      }
      console.log(`  ${`${summe}`.padStart(6)}  gesamt\n`);
    }

    console.log(nurVorschau ? `${gesamt} Datensätze wären betroffen.` : `${gesamt} Datensätze gelöscht.`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error("Aufbewahrungslauf fehlgeschlagen:", error);
  process.exit(1);
});
