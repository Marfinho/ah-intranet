import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

function adapter(): PrismaPg {
  const adresse = process.env.VERWALTUNG_DATABASE_URL;
  if (!adresse) {
    throw new Error("VERWALTUNG_DATABASE_URL ist nicht gesetzt.");
  }
  // `?schema=` ist eine Prisma-Eigenheit, die der Treiber nicht kennt.
  const schema = new URL(adresse).searchParams.get("schema") ?? undefined;
  return new PrismaPg(
    { connectionString: adresse, max: 5, connectionTimeoutMillis: 5_000 },
    schema ? { schema } : undefined,
  );
}

/**
 * Der Client für die eigenen Daten der Verwaltung (Schema `verwaltung`).
 * Die Kundendaten erreicht die Verwaltung ausschließlich über `IntranetService`.
 */
@Injectable()
export class DatenbankService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: adapter() });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
