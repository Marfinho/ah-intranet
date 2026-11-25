import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

/** Eigener Client für Skripte außerhalb von Nest. */
export function neuerClient(): PrismaClient {
  const adresse = process.env.VERWALTUNG_DATABASE_URL;
  if (!adresse) throw new Error("VERWALTUNG_DATABASE_URL ist nicht gesetzt.");
  const schema = new URL(adresse).searchParams.get("schema") ?? undefined;
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: adresse, max: 2 }, schema ? { schema } : undefined),
  });
}
