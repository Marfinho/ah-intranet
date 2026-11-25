-- Arbeitszeitprofil je Person
ALTER TABLE "User" ADD COLUMN "wochenstunden" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN "zeitfensterVon" TEXT;
ALTER TABLE "User" ADD COLUMN "zeitfensterBis" TEXT;
ALTER TABLE "User" ADD COLUMN "arbeitstage" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[];

-- Schichtarten
CREATE TABLE "Schichtart" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "startZeit" TEXT NOT NULL,
    "endZeit" TEXT NOT NULL,
    "pauseMinuten" INTEGER NOT NULL DEFAULT 0,
    "mindestBesetzung" INTEGER NOT NULL,
    "idealBesetzung" INTEGER NOT NULL,
    "tage" INTEGER[],
    "beiSondertag" BOOLEAN NOT NULL DEFAULT false,
    "locationId" TEXT,
    "departmentId" TEXT,
    "teamLeadId" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schichtart_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Schichtart_tenantId_idx" ON "Schichtart"("tenantId");

ALTER TABLE "Schichtart" ADD CONSTRAINT "Schichtart_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Schichtart" ADD CONSTRAINT "Schichtart_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Schichtart" ADD CONSTRAINT "Schichtart_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Schichtart" ADD CONSTRAINT "Schichtart_teamLeadId_fkey" FOREIGN KEY ("teamLeadId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Schichten: Herkunft und Pause
ALTER TABLE "Shift" ADD COLUMN "schichtartId" TEXT;
ALTER TABLE "Shift" ADD COLUMN "pauseMinuten" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_schichtartId_fkey" FOREIGN KEY ("schichtartId") REFERENCES "Schichtart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
