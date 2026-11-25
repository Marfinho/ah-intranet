-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "verwaltung";

-- CreateEnum
CREATE TYPE "BetreiberRolle" AS ENUM ('inhaber', 'lesend');

-- CreateTable
CREATE TABLE "Betreiber" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rolle" "BetreiberRolle" NOT NULL DEFAULT 'lesend',
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "totpSecret" TEXT,
    "totpEnabledAt" TIMESTAMP(3),
    "totpLastStep" INTEGER,
    "totpRecoveryHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Betreiber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Protokoll" (
    "id" TEXT NOT NULL,
    "betreiberId" TEXT,
    "betreiberName" TEXT NOT NULL,
    "aktion" TEXT NOT NULL,
    "objektTyp" TEXT NOT NULL,
    "objektId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Protokoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schnappschuss" (
    "id" TEXT NOT NULL,
    "tag" DATE NOT NULL,
    "bereich" TEXT NOT NULL,
    "werte" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Schnappschuss_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Betreiber_username_key" ON "Betreiber"("username");

-- CreateIndex
CREATE INDEX "Protokoll_createdAt_idx" ON "Protokoll"("createdAt");

-- CreateIndex
CREATE INDEX "Protokoll_objektTyp_objektId_idx" ON "Protokoll"("objektTyp", "objektId");

-- CreateIndex
CREATE INDEX "Schnappschuss_bereich_tag_idx" ON "Schnappschuss"("bereich", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "Schnappschuss_tag_bereich_key" ON "Schnappschuss"("tag", "bereich");

-- AddForeignKey
ALTER TABLE "Protokoll" ADD CONSTRAINT "Protokoll_betreiberId_fkey" FOREIGN KEY ("betreiberId") REFERENCES "Betreiber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

