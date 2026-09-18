-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('not_configured', 'configured', 'disabled');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('inbound', 'outbound');

-- CreateTable
CREATE TABLE "Connector" (
    "key" TEXT NOT NULL,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'not_configured',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "secrets" JSONB NOT NULL DEFAULT '{}',
    "lastCheckAt" TIMESTAMP(3),
    "lastCheckOk" BOOLEAN,
    "lastCheckMessage" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "connectorKey" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "direction" "SyncDirection" NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "detailJson" JSONB,
    "triggeredBy" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalRef" (
    "id" TEXT NOT NULL,
    "connectorKey" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payloadHash" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleListing" (
    "id" TEXT NOT NULL,
    "connectorKey" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "vin" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "mileageKm" INTEGER,
    "firstRegistration" TIMESTAMP(3),
    "fuel" TEXT,
    "gearbox" TEXT,
    "powerKw" INTEGER,
    "url" TEXT,
    "imageUrl" TEXT,
    "raw" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncRun_connectorKey_startedAt_idx" ON "SyncRun"("connectorKey", "startedAt");

-- CreateIndex
CREATE INDEX "SyncRun_status_idx" ON "SyncRun"("status");

-- CreateIndex
CREATE INDEX "ExternalRef_connectorKey_entityType_externalId_idx" ON "ExternalRef"("connectorKey", "entityType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRef_connectorKey_entityType_localId_key" ON "ExternalRef"("connectorKey", "entityType", "localId");

-- CreateIndex
CREATE INDEX "VehicleListing_make_model_idx" ON "VehicleListing"("make", "model");

-- CreateIndex
CREATE INDEX "VehicleListing_syncedAt_idx" ON "VehicleListing"("syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleListing_connectorKey_externalId_key" ON "VehicleListing"("connectorKey", "externalId");

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_connectorKey_fkey" FOREIGN KEY ("connectorKey") REFERENCES "Connector"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRef" ADD CONSTRAINT "ExternalRef_connectorKey_fkey" FOREIGN KEY ("connectorKey") REFERENCES "Connector"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleListing" ADD CONSTRAINT "VehicleListing_connectorKey_fkey" FOREIGN KEY ("connectorKey") REFERENCES "Connector"("key") ON DELETE CASCADE ON UPDATE CASCADE;
