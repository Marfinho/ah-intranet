-- Plan-Entwürfe: ein Dienstplan in Arbeit, getrennt vom echten Plan
CREATE TABLE "Planentwurf" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "von" DATE NOT NULL,
    "bis" DATE NOT NULL,
    "basis" TEXT NOT NULL,
    "daten" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Planentwurf_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Planentwurf_tenantId_von_idx" ON "Planentwurf"("tenantId", "von");

ALTER TABLE "Planentwurf" ADD CONSTRAINT "Planentwurf_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Planentwurf" ADD CONSTRAINT "Planentwurf_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Planentwurf" ADD CONSTRAINT "Planentwurf_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
