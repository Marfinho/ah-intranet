-- CreateEnum
CREATE TYPE "ShiftSwapStatus" AS ENUM ('offen', 'angenommen', 'freigegeben', 'abgelehnt', 'zurueckgezogen');

-- CreateEnum
CREATE TYPE "CustodyKind" AS ENUM ('fundsache', 'schluessel');

-- CreateEnum
CREATE TYPE "CustodyStatus" AS ENUM ('verwahrt', 'ausgegeben', 'abgeholt', 'entsorgt');

-- CreateEnum
CREATE TYPE "CustodyEventKind" AS ENUM ('aufgenommen', 'ausgegeben', 'zurueckgenommen', 'abgeholt', 'entsorgt');

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "locationId" TEXT,
    "departmentId" TEXT,
    "assigneeId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftSwap" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "shiftId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "ShiftSwapStatus" NOT NULL DEFAULT 'offen',
    "note" TEXT,
    "respondedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftSwap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustodyItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "kind" "CustodyKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storagePlace" TEXT,
    "locationId" TEXT,
    "status" "CustodyStatus" NOT NULL DEFAULT 'verwahrt',
    "holderId" TEXT,
    "foundAt" TIMESTAMP(3),
    "foundPlace" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustodyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustodyEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "itemId" TEXT NOT NULL,
    "kind" "CustodyEventKind" NOT NULL,
    "personId" TEXT,
    "personName" TEXT,
    "note" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustodyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealOffer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "date" DATE NOT NULL,
    "provider" TEXT NOT NULL,
    "orderDeadline" TIMESTAMP(3) NOT NULL,
    "locationId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealOption" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "offerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,

    CONSTRAINT "MealOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "offerId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shift_tenantId_startsAt_idx" ON "Shift"("tenantId", "startsAt");

-- CreateIndex
CREATE INDEX "Shift_assigneeId_idx" ON "Shift"("assigneeId");

-- CreateIndex
CREATE INDEX "ShiftSwap_tenantId_status_idx" ON "ShiftSwap"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ShiftSwap_shiftId_idx" ON "ShiftSwap"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftSwap_targetId_idx" ON "ShiftSwap"("targetId");

-- CreateIndex
CREATE INDEX "CustodyItem_tenantId_status_idx" ON "CustodyItem"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CustodyItem_holderId_idx" ON "CustodyItem"("holderId");

-- CreateIndex
CREATE INDEX "CustodyEvent_tenantId_itemId_idx" ON "CustodyEvent"("tenantId", "itemId");

-- CreateIndex
CREATE INDEX "MealOffer_tenantId_date_idx" ON "MealOffer"("tenantId", "date");

-- CreateIndex
CREATE INDEX "MealOption_tenantId_offerId_idx" ON "MealOption"("tenantId", "offerId");

-- CreateIndex
CREATE INDEX "MealOrder_tenantId_offerId_idx" ON "MealOrder"("tenantId", "offerId");

-- CreateIndex
CREATE UNIQUE INDEX "MealOrder_tenantId_offerId_userId_key" ON "MealOrder"("tenantId", "offerId", "userId");

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyItem" ADD CONSTRAINT "CustodyItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyItem" ADD CONSTRAINT "CustodyItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyItem" ADD CONSTRAINT "CustodyItem_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyItem" ADD CONSTRAINT "CustodyItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyEvent" ADD CONSTRAINT "CustodyEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyEvent" ADD CONSTRAINT "CustodyEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CustodyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyEvent" ADD CONSTRAINT "CustodyEvent_personId_fkey" FOREIGN KEY ("personId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyEvent" ADD CONSTRAINT "CustodyEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealOffer" ADD CONSTRAINT "MealOffer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealOffer" ADD CONSTRAINT "MealOffer_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealOffer" ADD CONSTRAINT "MealOffer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealOption" ADD CONSTRAINT "MealOption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealOption" ADD CONSTRAINT "MealOption_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "MealOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealOrder" ADD CONSTRAINT "MealOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealOrder" ADD CONSTRAINT "MealOrder_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "MealOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealOrder" ADD CONSTRAINT "MealOrder_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "MealOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealOrder" ADD CONSTRAINT "MealOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
