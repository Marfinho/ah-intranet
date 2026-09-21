-- Anmeldung über Microsoft Entra ID und lesender Zugriff auf den
-- Outlook-Kalender. Verknüpfung über die Objekt-ID des Entra-Kontos, nicht
-- nur die E-Mail-Adresse - die kann sich ändern, die Objekt-ID nicht.
-- Der Refresh-Token wird verschlüsselt abgelegt (core/geheimnis.ts) und dient
-- ausschließlich dem lesenden Kalenderzugriff; Kalendereinträge selbst werden
-- nicht gespeichert, sondern bei jedem Aufruf live von Microsoft Graph geholt.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "entraObjectId" TEXT;
ALTER TABLE "User" ADD COLUMN "msRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN "msTokenUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_entraObjectId_key" ON "User"("tenantId", "entraObjectId");
