-- Logo je Mandant: löst in der Kopfzeile die Wortmarke "AHOI" ab, sobald eines
-- hinterlegt ist. Gespeichert als Data-URL, serverseitig auf 200 KB begrenzt -
-- für die Größenordnung eines Logos reicht das, ohne eine eigene
-- Dateiablage einzuführen, die es heute noch nicht gibt.

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "logoUrl" TEXT;
