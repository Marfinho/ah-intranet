import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

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
 * `?schema=` in der Adresse ist eine Prisma-Eigenheit, die der Treiber nicht
 * kennt - sie wird hier herausgelesen und als Option übergeben.
 */
export function neuerClient(): PrismaClient {
  const adresse = process.env.DATABASE_URL;
  if (!adresse) {
    throw new Error("DATABASE_URL ist nicht gesetzt.");
  }
  const schema = new URL(adresse).searchParams.get("schema") ?? undefined;
  const adapter = new PrismaPg(
    { connectionString: adresse, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 300_000 },
    schema ? { schema } : undefined,
  );
  return new PrismaClient({ adapter });
}
