-- DropForeignKey
ALTER TABLE "ExternalRef" DROP CONSTRAINT "ExternalRef_connectorKey_fkey";

-- DropForeignKey
ALTER TABLE "SyncRun" DROP CONSTRAINT "SyncRun_connectorKey_fkey";

-- DropForeignKey
ALTER TABLE "VehicleListing" DROP CONSTRAINT "VehicleListing_connectorKey_fkey";

-- DropIndex
DROP INDEX "BusinessCardFieldDefinition_key_key";

-- DropIndex
DROP INDEX "Department_code_key";

-- DropIndex
DROP INDEX "Department_name_key";

-- DropIndex
DROP INDEX "ExternalRef_connectorKey_entityType_localId_key";

-- DropIndex
DROP INDEX "IdeaVote_ideaId_userId_key";

-- DropIndex
DROP INDEX "Location_code_key";

-- DropIndex
DROP INDEX "Location_name_key";

-- DropIndex
DROP INDEX "LocationDepartment_locationId_departmentId_key";

-- DropIndex
DROP INDEX "NewsPost_slug_key";

-- DropIndex
DROP INDEX "NewsRead_newsPostId_userId_key";

-- DropIndex
DROP INDEX "OnboardingAssignment_templateId_userId_key";

-- DropIndex
DROP INDEX "OnboardingItem_assignmentId_stepId_key";

-- DropIndex
DROP INDEX "Order_orderNumber_key";

-- DropIndex
DROP INDEX "Permission_key_key";

-- DropIndex
DROP INDEX "PollVote_pollId_userId_key";

-- DropIndex
DROP INDEX "Role_key_key";

-- DropIndex
DROP INDEX "RolePermission_roleId_permissionId_key";

-- DropIndex
DROP INDEX "SpecialtyArea_code_key";

-- DropIndex
DROP INDEX "SpecialtyArea_name_key";

-- DropIndex
DROP INDEX "Ticket_number_key";

-- DropIndex
DROP INDEX "User_email_key";

-- DropIndex
DROP INDEX "User_username_key";

-- DropIndex
DROP INDEX "UserRole_userId_roleId_scopeType_scopeLocationId_scopeDepar_key";

-- DropIndex
DROP INDEX "Vehicle_plate_key";

-- DropIndex
DROP INDEX "VehicleListing_connectorKey_externalId_key";

-- DropIndex
DROP INDEX "WikiArticle_slug_key";

-- DropIndex
DROP INDEX "WorkwearItemSize_catalogItemId_sizeLabel_key";

-- AlterTable
ALTER TABLE "Absence" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ApprovalDecision" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ApprovalRule" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "BusinessCardFieldDefinition" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "BusinessCardOrder" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "BusinessCardOrderField" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Connector" DROP CONSTRAINT "Connector_pkey",
ADD COLUMN     "tenantId" TEXT NOT NULL,
ADD CONSTRAINT "Connector_pkey" PRIMARY KEY ("tenantId", "key");

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ExternalRef" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Idea" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "IdeaVote" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "LocationDepartment" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ModuleSetting" DROP CONSTRAINT "ModuleSetting_pkey",
ADD COLUMN     "tenantId" TEXT NOT NULL,
ADD CONSTRAINT "ModuleSetting_pkey" PRIMARY KEY ("tenantId", "key");

-- AlterTable
ALTER TABLE "NewsAttachment" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "NewsComment" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "NewsPost" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "NewsRead" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OnboardingAssignment" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OnboardingItem" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OnboardingStep" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OnboardingTemplate" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OrderComment" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OrderCycle" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OrderStatusHistory" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Poll" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PollOption" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PollVote" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "QuickLink" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "RolePermission" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "RoomBooking" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SpecialtyArea" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SyncRun" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TicketComment" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UserRole" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VehicleBooking" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VehicleListing" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WikiArticle" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WorkwearCatalogItem" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WorkwearItemSize" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WorkwearOrder" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WorkwearOrderItem" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_domain_key" ON "Tenant"("domain");

-- CreateIndex
CREATE INDEX "Tenant_isActive_idx" ON "Tenant"("isActive");

-- CreateIndex
CREATE INDEX "Absence_tenantId_idx" ON "Absence"("tenantId");

-- CreateIndex
CREATE INDEX "ApprovalDecision_tenantId_idx" ON "ApprovalDecision"("tenantId");

-- CreateIndex
CREATE INDEX "ApprovalRule_tenantId_idx" ON "ApprovalRule"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "BusinessCardFieldDefinition_tenantId_idx" ON "BusinessCardFieldDefinition"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCardFieldDefinition_tenantId_key_key" ON "BusinessCardFieldDefinition"("tenantId", "key");

-- CreateIndex
CREATE INDEX "BusinessCardOrder_tenantId_idx" ON "BusinessCardOrder"("tenantId");

-- CreateIndex
CREATE INDEX "BusinessCardOrderField_tenantId_idx" ON "BusinessCardOrderField"("tenantId");

-- CreateIndex
CREATE INDEX "CalendarEvent_tenantId_idx" ON "CalendarEvent"("tenantId");

-- CreateIndex
CREATE INDEX "Connector_tenantId_idx" ON "Connector"("tenantId");

-- CreateIndex
CREATE INDEX "Department_tenantId_idx" ON "Department"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenantId_name_key" ON "Department"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenantId_code_key" ON "Department"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Document_tenantId_idx" ON "Document"("tenantId");

-- CreateIndex
CREATE INDEX "ExternalRef_tenantId_idx" ON "ExternalRef"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRef_tenantId_connectorKey_entityType_localId_key" ON "ExternalRef"("tenantId", "connectorKey", "entityType", "localId");

-- CreateIndex
CREATE INDEX "Idea_tenantId_idx" ON "Idea"("tenantId");

-- CreateIndex
CREATE INDEX "IdeaVote_tenantId_idx" ON "IdeaVote"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaVote_tenantId_ideaId_userId_key" ON "IdeaVote"("tenantId", "ideaId", "userId");

-- CreateIndex
CREATE INDEX "Location_tenantId_idx" ON "Location"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_tenantId_name_key" ON "Location"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Location_tenantId_code_key" ON "Location"("tenantId", "code");

-- CreateIndex
CREATE INDEX "LocationDepartment_tenantId_idx" ON "LocationDepartment"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationDepartment_tenantId_locationId_departmentId_key" ON "LocationDepartment"("tenantId", "locationId", "departmentId");

-- CreateIndex
CREATE INDEX "ModuleSetting_tenantId_idx" ON "ModuleSetting"("tenantId");

-- CreateIndex
CREATE INDEX "NewsAttachment_tenantId_idx" ON "NewsAttachment"("tenantId");

-- CreateIndex
CREATE INDEX "NewsComment_tenantId_idx" ON "NewsComment"("tenantId");

-- CreateIndex
CREATE INDEX "NewsPost_tenantId_idx" ON "NewsPost"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsPost_tenantId_slug_key" ON "NewsPost"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "NewsRead_tenantId_idx" ON "NewsRead"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsRead_tenantId_newsPostId_userId_key" ON "NewsRead"("tenantId", "newsPostId", "userId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

-- CreateIndex
CREATE INDEX "OnboardingAssignment_tenantId_idx" ON "OnboardingAssignment"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingAssignment_tenantId_templateId_userId_key" ON "OnboardingAssignment"("tenantId", "templateId", "userId");

-- CreateIndex
CREATE INDEX "OnboardingItem_tenantId_idx" ON "OnboardingItem"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingItem_tenantId_assignmentId_stepId_key" ON "OnboardingItem"("tenantId", "assignmentId", "stepId");

-- CreateIndex
CREATE INDEX "OnboardingStep_tenantId_idx" ON "OnboardingStep"("tenantId");

-- CreateIndex
CREATE INDEX "OnboardingTemplate_tenantId_idx" ON "OnboardingTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "Order_tenantId_idx" ON "Order"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenantId_orderNumber_key" ON "Order"("tenantId", "orderNumber");

-- CreateIndex
CREATE INDEX "OrderComment_tenantId_idx" ON "OrderComment"("tenantId");

-- CreateIndex
CREATE INDEX "OrderCycle_tenantId_idx" ON "OrderCycle"("tenantId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_tenantId_idx" ON "OrderStatusHistory"("tenantId");

-- CreateIndex
CREATE INDEX "Permission_tenantId_idx" ON "Permission"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_tenantId_key_key" ON "Permission"("tenantId", "key");

-- CreateIndex
CREATE INDEX "Poll_tenantId_idx" ON "Poll"("tenantId");

-- CreateIndex
CREATE INDEX "PollOption_tenantId_idx" ON "PollOption"("tenantId");

-- CreateIndex
CREATE INDEX "PollVote_tenantId_idx" ON "PollVote"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_tenantId_pollId_userId_key" ON "PollVote"("tenantId", "pollId", "userId");

-- CreateIndex
CREATE INDEX "QuickLink_tenantId_idx" ON "QuickLink"("tenantId");

-- CreateIndex
CREATE INDEX "Role_tenantId_idx" ON "Role"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_key_key" ON "Role"("tenantId", "key");

-- CreateIndex
CREATE INDEX "RolePermission_tenantId_idx" ON "RolePermission"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_tenantId_roleId_permissionId_key" ON "RolePermission"("tenantId", "roleId", "permissionId");

-- CreateIndex
CREATE INDEX "Room_tenantId_idx" ON "Room"("tenantId");

-- CreateIndex
CREATE INDEX "RoomBooking_tenantId_idx" ON "RoomBooking"("tenantId");

-- CreateIndex
CREATE INDEX "SpecialtyArea_tenantId_idx" ON "SpecialtyArea"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyArea_tenantId_name_key" ON "SpecialtyArea"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyArea_tenantId_code_key" ON "SpecialtyArea"("tenantId", "code");

-- CreateIndex
CREATE INDEX "SyncRun_tenantId_idx" ON "SyncRun"("tenantId");

-- CreateIndex
CREATE INDEX "Ticket_tenantId_idx" ON "Ticket"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_tenantId_number_key" ON "Ticket"("tenantId", "number");

-- CreateIndex
CREATE INDEX "TicketComment_tenantId_idx" ON "TicketComment"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_username_key" ON "User"("tenantId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "UserRole_tenantId_idx" ON "UserRole"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_tenantId_userId_roleId_scopeType_scopeLocationId_s_key" ON "UserRole"("tenantId", "userId", "roleId", "scopeType", "scopeLocationId", "scopeDepartmentId", "scopeSpecialtyAreaId");

-- CreateIndex
CREATE INDEX "Vehicle_tenantId_idx" ON "Vehicle"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_tenantId_plate_key" ON "Vehicle"("tenantId", "plate");

-- CreateIndex
CREATE INDEX "VehicleBooking_tenantId_idx" ON "VehicleBooking"("tenantId");

-- CreateIndex
CREATE INDEX "VehicleListing_tenantId_idx" ON "VehicleListing"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleListing_tenantId_connectorKey_externalId_key" ON "VehicleListing"("tenantId", "connectorKey", "externalId");

-- CreateIndex
CREATE INDEX "WikiArticle_tenantId_idx" ON "WikiArticle"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiArticle_tenantId_slug_key" ON "WikiArticle"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "WorkwearCatalogItem_tenantId_idx" ON "WorkwearCatalogItem"("tenantId");

-- CreateIndex
CREATE INDEX "WorkwearItemSize_tenantId_idx" ON "WorkwearItemSize"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkwearItemSize_tenantId_catalogItemId_sizeLabel_key" ON "WorkwearItemSize"("tenantId", "catalogItemId", "sizeLabel");

-- CreateIndex
CREATE INDEX "WorkwearOrder_tenantId_idx" ON "WorkwearOrder"("tenantId");

-- CreateIndex
CREATE INDEX "WorkwearOrderItem_tenantId_idx" ON "WorkwearOrderItem"("tenantId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialtyArea" ADD CONSTRAINT "SpecialtyArea_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationDepartment" ADD CONSTRAINT "LocationDepartment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleSetting" ADD CONSTRAINT "ModuleSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsPost" ADD CONSTRAINT "NewsPost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsAttachment" ADD CONSTRAINT "NewsAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsComment" ADD CONSTRAINT "NewsComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsRead" ADD CONSTRAINT "NewsRead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderComment" ADD CONSTRAINT "OrderComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCardFieldDefinition" ADD CONSTRAINT "BusinessCardFieldDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCardOrder" ADD CONSTRAINT "BusinessCardOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCardOrderField" ADD CONSTRAINT "BusinessCardOrderField_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkwearCatalogItem" ADD CONSTRAINT "WorkwearCatalogItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkwearItemSize" ADD CONSTRAINT "WorkwearItemSize_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkwearOrder" ADD CONSTRAINT "WorkwearOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkwearOrderItem" ADD CONSTRAINT "WorkwearOrderItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCycle" ADD CONSTRAINT "OrderCycle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiArticle" ADD CONSTRAINT "WikiArticle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBooking" ADD CONSTRAINT "RoomBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleBooking" ADD CONSTRAINT "VehicleBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplate" ADD CONSTRAINT "OnboardingTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingStep" ADD CONSTRAINT "OnboardingStep_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingAssignment" ADD CONSTRAINT "OnboardingAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingItem" ADD CONSTRAINT "OnboardingItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaVote" ADD CONSTRAINT "IdeaVote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickLink" ADD CONSTRAINT "QuickLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_tenantId_connectorKey_fkey" FOREIGN KEY ("tenantId", "connectorKey") REFERENCES "Connector"("tenantId", "key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRef" ADD CONSTRAINT "ExternalRef_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRef" ADD CONSTRAINT "ExternalRef_tenantId_connectorKey_fkey" FOREIGN KEY ("tenantId", "connectorKey") REFERENCES "Connector"("tenantId", "key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleListing" ADD CONSTRAINT "VehicleListing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleListing" ADD CONSTRAINT "VehicleListing_tenantId_connectorKey_fkey" FOREIGN KEY ("tenantId", "connectorKey") REFERENCES "Connector"("tenantId", "key") ON DELETE CASCADE ON UPDATE CASCADE;

