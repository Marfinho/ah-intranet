-- Lizenzgrenzen je Haus (Standorte, Benutzerkonten) und Grundlage für das
-- Warnsystem des Betreibers (Systemlast, Schwellwerte, Empfängeradresse).

ALTER TABLE "Tenant" ADD COLUMN "maxLocations" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN "maxUsers" INTEGER;

CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "alertEmail" TEXT,
    "cpuThresholdPercent" INTEGER NOT NULL DEFAULT 85,
    "memThresholdPercent" INTEGER NOT NULL DEFAULT 90,
    "diskThresholdPercent" INTEGER NOT NULL DEFAULT 90,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "lastAlertAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemMetricSample" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loadAvg1" DOUBLE PRECISION NOT NULL,
    "cpuPercent" DOUBLE PRECISION NOT NULL,
    "memPercent" DOUBLE PRECISION NOT NULL,
    "diskPercent" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SystemMetricSample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemMetricSample_createdAt_idx" ON "SystemMetricSample"("createdAt");
