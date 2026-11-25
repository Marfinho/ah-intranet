import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 liest die Datenbank-Adresse nicht mehr aus dem Schema, sondern von
 * hier. `env()` würde bei fehlender Variable abbrechen - auch bei `prisma
 * generate` in der CI, das keine Datenbank braucht -, deshalb der direkte Zugriff.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Wird nur noch ausdrücklich ausgeführt (`prisma db seed`), nicht mehr nach
    // `migrate dev` oder `migrate reset`.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
    // Für den Abweichungsvergleich in der CI (`migrate diff`).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
