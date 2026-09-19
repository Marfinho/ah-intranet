-- AHOI behandelt den Betriebsalltag, nicht das Autogeschäft.
-- Diese Migration entfernt Tabellen samt Inhalt. Sie ist nicht umkehrbar;
-- der Rückweg ist die Sicherung, die vor dem Einspielen gezogen wird.

-- DropForeignKey
ALTER TABLE "Connector" DROP CONSTRAINT "Connector_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ExternalRef" DROP CONSTRAINT "ExternalRef_tenantId_connectorKey_fkey";

-- DropForeignKey
ALTER TABLE "ExternalRef" DROP CONSTRAINT "ExternalRef_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "SyncRun" DROP CONSTRAINT "SyncRun_tenantId_connectorKey_fkey";

-- DropForeignKey
ALTER TABLE "SyncRun" DROP CONSTRAINT "SyncRun_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_locationId_fkey";

-- DropForeignKey
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "VehicleBooking" DROP CONSTRAINT "VehicleBooking_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "VehicleBooking" DROP CONSTRAINT "VehicleBooking_userId_fkey";

-- DropForeignKey
ALTER TABLE "VehicleBooking" DROP CONSTRAINT "VehicleBooking_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "VehicleListing" DROP CONSTRAINT "VehicleListing_tenantId_connectorKey_fkey";

-- DropForeignKey
ALTER TABLE "VehicleListing" DROP CONSTRAINT "VehicleListing_tenantId_fkey";

-- DropTable
DROP TABLE "Connector";

-- DropTable
DROP TABLE "ExternalRef";

-- DropTable
DROP TABLE "SyncRun";

-- DropTable
DROP TABLE "Vehicle";

-- DropTable
DROP TABLE "VehicleBooking";

-- DropTable
DROP TABLE "VehicleListing";

-- DropEnum
DROP TYPE "BookingStatus";

-- DropEnum
DROP TYPE "ConnectorStatus";

-- DropEnum
DROP TYPE "VehicleCategory";

