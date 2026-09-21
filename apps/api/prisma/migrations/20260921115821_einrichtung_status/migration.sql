-- CreateEnum
CREATE TYPE "EinrichtungVariante" AS ENUM ('gruppenadmin', 'standortleitung', 'mitarbeiter');

-- CreateTable
CREATE TABLE "EinrichtungStatus" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL,
    "variante" "EinrichtungVariante" NOT NULL,
    "willkommenGezeigt" BOOLEAN NOT NULL DEFAULT false,
    "uebersprungen" BOOLEAN NOT NULL DEFAULT false,
    "abgeschlossen" BOOLEAN NOT NULL DEFAULT false,
    "abgeschlossenAm" TIMESTAMP(3),
    "fortschritt" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EinrichtungStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EinrichtungStatus_tenantId_idx" ON "EinrichtungStatus"("tenantId");

-- CreateIndex
CREATE INDEX "EinrichtungStatus_userId_idx" ON "EinrichtungStatus"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EinrichtungStatus_tenantId_userId_key" ON "EinrichtungStatus"("tenantId", "userId");

-- AddForeignKey
ALTER TABLE "EinrichtungStatus" ADD CONSTRAINT "EinrichtungStatus_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EinrichtungStatus" ADD CONSTRAINT "EinrichtungStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
