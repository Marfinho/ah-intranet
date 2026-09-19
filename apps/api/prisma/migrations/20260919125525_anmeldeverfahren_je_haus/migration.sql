-- CreateEnum
CREATE TYPE "AuthProviderKind" AS ENUM ('entra');

-- CreateTable
CREATE TABLE "TenantAuthProvider" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "kind" "AuthProviderKind" NOT NULL,
    "label" TEXT NOT NULL,
    "directory" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAuthProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantAuthProvider_tenantId_idx" ON "TenantAuthProvider"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAuthProvider_tenantId_kind_key" ON "TenantAuthProvider"("tenantId", "kind");

-- AddForeignKey
ALTER TABLE "TenantAuthProvider" ADD CONSTRAINT "TenantAuthProvider_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
