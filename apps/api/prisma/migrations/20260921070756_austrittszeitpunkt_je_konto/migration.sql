-- AlterTable
ALTER TABLE "User" ADD COLUMN     "inactiveSince" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_status_inactiveSince_idx" ON "User"("status", "inactiveSince");
