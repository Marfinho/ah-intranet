-- Halbtage und Erfassung durch Dritte
ALTER TABLE "Absence" ADD COLUMN "startHalb" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Absence" ADD COLUMN "endHalb" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Absence" ADD COLUMN "recordedById" TEXT;
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
