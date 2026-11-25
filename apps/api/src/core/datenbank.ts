import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

/** Verbindungen je Client: `DB_POOL_MAX` (Standard 10), mindestens 2, mal Anteil. */
function poolGroesse(anteil: number): number {
  const gesamt = Number.parseInt(process.env.DB_POOL_MAX ?? "", 10);
  const basis = Number.isFinite(gesamt) && gesamt >= 2 ? gesamt : 10;
  return Math.max(2, Math.round(basis * anteil));
}

/**
 * Erzeugt einen Datenbank-Client. Die einzige Stelle, an der der Treiber
 * konfiguriert wird.
 *
 * Seit Prisma 7 ist ein Treiber-Adapter Pflicht (`node-pg`), die Engine in
 * Rust entfällt. Die Pool-Vorgaben des Adapters sind andere als vorher (kein
 * Verbindungs-Timeout, Leerlauf nach 10 s statt 5 min); hier stehen die alten
 * Werte, damit sich das Verhalten unter Last und bei kurzen Aussetzern der
 * Datenbank nicht verschiebt.
 *
 * Die Poolgröße steht ausdrücklich da: der Treiber nähme sonst 10 je Client, und
 * ein Prozess hat zwei (Anwendung und Mandantenauflösung) - bis zu 20
 * Verbindungen statt wie zuvor `CPUs * 2 + 1` je Client. Der Standard der
 * Anwendung ist 10, `DB_POOL_MAX` ändert ihn; die Mandantenauflösung macht nur
 * kleine, zwischengespeicherte Abfragen und bekommt ein Drittel davon.
 * Zusammen bleibt ein Prozess bei 13 Verbindungen, PostgreSQL erlaubt
 * standardmäßig 100.
 *
 * `?schema=` in der Adresse ist eine Prisma-Eigenheit, die der Treiber nicht
 * kennt - sie wird hier herausgelesen und als Option übergeben.
 */
export function neuerClient(anteil = 1): PrismaClient {
  const adresse = process.env.DATABASE_URL;
  if (!adresse) {
    throw new Error("DATABASE_URL ist nicht gesetzt.");
  }
  const schema = new URL(adresse).searchParams.get("schema") ?? undefined;
  const adapter = new PrismaPg(
    { connectionString: adresse, max: poolGroesse(anteil), connectionTimeoutMillis: 5_000, idleTimeoutMillis: 300_000 },
    schema ? { schema } : undefined,
  );
  return new PrismaClient({ adapter });
}
