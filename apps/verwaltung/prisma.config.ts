import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Eigenes Schema, eigene Migrationen: die Verwaltung führt ihre Daten
 * (Betreiberkonten, Protokoll, Kennzahlen-Verlauf) getrennt von denen der
 * Kundenhäuser. `?schema=verwaltung` in der Adresse legt sie in ein eigenes
 * PostgreSQL-Schema - dieselbe Datenbank, dieselbe Sicherung, aber keine
 * gemeinsame Tabelle mit dem Kundendienst.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.VERWALTUNG_DATABASE_URL ?? "" },
});
