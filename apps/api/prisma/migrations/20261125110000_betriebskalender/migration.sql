-- CreateEnum
CREATE TYPE "BetriebstagArt" AS ENUM ('feiertag', 'brueckentag', 'verkaufsoffen', 'betriebsfrei', 'sondertag');

-- AlterTable
ALTER TABLE "Location" ADD COLUMN "bundesland" TEXT;

-- CreateTable
CREATE TABLE "Betriebstag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "locationId" TEXT,
    "datum" DATE NOT NULL,
    "art" "BetriebstagArt" NOT NULL,
    "name" TEXT NOT NULL,
    "arbeitsfrei" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Betriebstag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Betriebstag_tenantId_datum_idx" ON "Betriebstag"("tenantId", "datum");

-- CreateIndex
CREATE INDEX "Betriebstag_locationId_idx" ON "Betriebstag"("locationId");

-- AddForeignKey
ALTER TABLE "Betriebstag" ADD CONSTRAINT "Betriebstag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Betriebstag" ADD CONSTRAINT "Betriebstag_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
