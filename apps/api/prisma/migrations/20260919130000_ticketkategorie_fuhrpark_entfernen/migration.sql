-- Die Ticketkategorie Fuhrpark entfällt mit dem Modul.
-- Vorhandene Tickets dieser Kategorie müssten vorher umgetragen werden;
-- ohne solche Zeilen läuft die Umstellung durch.

-- AlterEnum
BEGIN;
CREATE TYPE "TicketCategory_new" AS ENUM ('it', 'facility', 'hr', 'marketing');
ALTER TABLE "Ticket" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "category" TYPE "TicketCategory_new" USING ("category"::text::"TicketCategory_new");
ALTER TYPE "TicketCategory" RENAME TO "TicketCategory_old";
ALTER TYPE "TicketCategory_new" RENAME TO "TicketCategory";
DROP TYPE "TicketCategory_old";
ALTER TABLE "Ticket" ALTER COLUMN "category" SET DEFAULT 'it';
COMMIT;

