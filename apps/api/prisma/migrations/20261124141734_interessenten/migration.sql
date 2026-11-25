-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('entwurf', 'versendet', 'angefragt', 'gewonnen', 'verloren');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "ansprechperson" TEXT,
    "notiz" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'entwurf',
    "tokenHash" TEXT NOT NULL,
    "tokenGueltigBis" TIMESTAMP(3) NOT NULL,
    "tokenWiderrufenAm" TIMESTAMP(3),
    "anzahlHaeuser" INTEGER NOT NULL,
    "anzahlNutzer" INTEGER NOT NULL,
    "keyUser" INTEGER,
    "tier" TEXT,
    "module" TEXT[],
    "angefragtAm" TIMESTAMP(3),
    "angebot" JSONB,
    "preislisteVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadStandort" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "leadId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "strasse" TEXT,
    "plz" TEXT,
    "ort" TEXT,
    "marken" TEXT[],
    "leistungen" TEXT[],
    "oeffnungszeiten" TEXT,
    "campus" TEXT,
    "vorschlag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadStandort_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_tokenHash_key" ON "Lead"("tokenHash");

-- CreateIndex
CREATE INDEX "Lead_tenantId_status_idx" ON "Lead"("tenantId", "status");

-- CreateIndex
CREATE INDEX "LeadStandort_tenantId_leadId_idx" ON "LeadStandort"("tenantId", "leadId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStandort" ADD CONSTRAINT "LeadStandort_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStandort" ADD CONSTRAINT "LeadStandort_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
