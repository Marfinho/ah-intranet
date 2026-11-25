-- CreateEnum
CREATE TYPE "VertretungsMeldung" AS ENUM ('aus', 'sofort', 'erster_tag');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "vertretungsMeldung" "VertretungsMeldung" NOT NULL DEFAULT 'sofort';

-- AlterTable
ALTER TABLE "Absence" ADD COLUMN "vertretungGemeldetAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Schluesselbesetzung" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "funktion" TEXT NOT NULL,
    "stufe" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schluesselbesetzung_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Schluesselbesetzung_tenantId_funktion_stufe_key" ON "Schluesselbesetzung"("tenantId", "funktion", "stufe");

-- CreateIndex
CREATE INDEX "Schluesselbesetzung_tenantId_idx" ON "Schluesselbesetzung"("tenantId");

-- CreateIndex
CREATE INDEX "Schluesselbesetzung_userId_idx" ON "Schluesselbesetzung"("userId");

-- AddForeignKey
ALTER TABLE "Schluesselbesetzung" ADD CONSTRAINT "Schluesselbesetzung_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schluesselbesetzung" ADD CONSTRAINT "Schluesselbesetzung_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
