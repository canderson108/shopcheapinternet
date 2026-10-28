-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('AGENT', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AgentAvailability" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ENROLLMENT_STARTED', 'INFORMATION_SUBMITTED', 'WAITING_FOR_AGENT', 'AGENT_ASSIGNED', 'AGENT_PROCESSING', 'ADDITIONAL_INFO_REQUIRED', 'SUBMITTED_TO_PROVIDER', 'PROVIDER_ORDER_CONFIRMED', 'UNABLE_TO_COMPLETE', 'CUSTOMER_CANCELED');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('INDICATIVE', 'ADVERTISED_IN_ZIP', 'AGENT_VERIFIED', 'NOT_AVAILABLE');

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('FIBER', 'FIXED_WIRELESS', 'CABLE', 'DSL', 'SATELLITE', 'OTHER');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('SYSTEM', 'STAFF', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('CUSTOMER', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'QUESTION', 'INFO_REQUEST', 'INSTALL_OPTIONS', 'PRICE_CHANGE', 'PROGRESS', 'RESPONSE');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'AGENT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mfaSecretEnc" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "availability" "AgentAvailability" NOT NULL DEFAULT 'OFFLINE',
    "maxActiveOrders" INTEGER NOT NULL DEFAULT 5,
    "lastAssignedAt" TIMESTAMP(3),
    "availabilityChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAssigned" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "emailEnc" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "phoneEnc" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "consentType" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "consentText" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "orderable" BOOLEAN NOT NULL DEFAULT false,
    "portalName" TEXT,
    "orderPortalUrl" TEXT,
    "orderInstructions" TEXT,
    "enrollmentRequirements" TEXT,
    "confirmationWorkflow" TEXT,
    "confirmationNumberLabel" TEXT NOT NULL DEFAULT 'Confirmation number',
    "disclosure" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "connectionType" "ConnectionType" NOT NULL,
    "downloadMbps" INTEGER NOT NULL,
    "uploadMbps" INTEGER NOT NULL,
    "monthlyPriceCents" INTEGER NOT NULL,
    "regularPriceCents" INTEGER,
    "priceTermMonths" INTEGER,
    "priceConditions" TEXT,
    "installationFeeCents" INTEGER,
    "installationNotes" TEXT,
    "equipmentFeeCents" INTEGER,
    "equipmentIncluded" TEXT,
    "promoDescription" TEXT,
    "promoExpiresAt" TIMESTAMP(3),
    "promoExpirationNote" TEXT,
    "contractRequired" BOOLEAN NOT NULL DEFAULT false,
    "contractTerms" TEXT,
    "dataCap" TEXT,
    "disclosures" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceCheckedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPriceHistory" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "monthlyPriceCents" INTEGER NOT NULL,
    "regularPriceCents" INTEGER,
    "promoDescription" TEXT,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceCheckedAt" TIMESTAMP(3) NOT NULL,
    "changedById" TEXT,
    "note" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceArea" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralSource" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "managementCompany" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultProviderId" TEXT,
    "referralSourceId" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyUnit" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "propertyId" TEXT,
    "unitNumber" TEXT,
    "referralSourceId" TEXT,
    "campaignId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "gclid" TEXT,
    "fbclid" TEXT,
    "landingPath" TEXT,
    "streetEnc" TEXT,
    "unitEnc" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "addressVerified" BOOLEAN NOT NULL DEFAULT false,
    "addressSource" TEXT,
    "addressEnteredAt" TIMESTAMP(3),
    "selectedPlanId" TEXT,
    "selectedPriceCents" INTEGER,
    "selectedAt" TIMESTAMP(3),
    "draftEnc" TEXT,
    "idempotencyKey" TEXT,
    "enrollmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnrollmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'INFORMATION_SUBMITTED',
    "statusVersion" INTEGER NOT NULL DEFAULT 0,
    "serviceStreetEnc" TEXT NOT NULL,
    "serviceUnitEnc" TEXT,
    "serviceCity" TEXT NOT NULL,
    "serviceState" TEXT NOT NULL,
    "serviceZip" TEXT NOT NULL,
    "addressVerified" BOOLEAN NOT NULL DEFAULT false,
    "billingSameAsService" BOOLEAN NOT NULL DEFAULT true,
    "billingAddressEnc" TEXT,
    "planSnapshot" JSONB NOT NULL,
    "advertisedPriceCents" INTEGER NOT NULL,
    "pricingSource" TEXT NOT NULL,
    "pricingCheckedAt" TIMESTAMP(3) NOT NULL,
    "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'INDICATIVE',
    "preferredInstallDate" DATE,
    "preferredInstallTime" TEXT,
    "customerNotesEnc" TEXT,
    "propertyId" TEXT,
    "unitNumber" TEXT,
    "referralSourceId" TEXT,
    "campaignId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "gclid" TEXT,
    "fbclid" TEXT,
    "gaClientId" TEXT,
    "assignedAgentId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "confirmationNumber" TEXT,
    "confirmedPlanName" TEXT,
    "confirmedPriceCents" INTEGER,
    "confirmedInstallDate" DATE,
    "orderSubmittedAt" TIMESTAMP(3),
    "confirmationNotes" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "unreadForAgent" INTEGER NOT NULL DEFAULT 0,
    "unreadForCustomer" INTEGER NOT NULL DEFAULT 0,
    "lastCustomerMessageAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "piiDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentStatusHistory" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "fromStatus" "EnrollmentStatus",
    "toStatus" "EnrollmentStatus" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorStaffId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnrollmentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAssignment" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "assignedById" TEXT,
    "reason" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    CONSTRAINT "AgentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "senderType" "MessageSender" NOT NULL,
    "staffAuthorId" TEXT,
    "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
    "bodyEnc" TEXT NOT NULL,
    "payload" JSONB,
    "responseToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentNote" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "bodyEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAccessToken" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSession" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorStaffId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "enrollmentId" TEXT,
    "metadata" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealtimeEvent" (
    "id" BIGSERIAL NOT NULL,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RealtimeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "template" TEXT NOT NULL,
    "toHash" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "StaffUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_staffUserId_key" ON "AgentProfile"("staffUserId");

-- CreateIndex
CREATE INDEX "AgentProfile_availability_lastAssignedAt_idx" ON "AgentProfile"("availability", "lastAssignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffSession_tokenHash_key" ON "StaffSession"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffSession_staffUserId_idx" ON "StaffSession"("staffUserId");

-- CreateIndex
CREATE INDEX "StaffSession_expiresAt_idx" ON "StaffSession"("expiresAt");

-- CreateIndex
CREATE INDEX "Customer_emailHash_idx" ON "Customer"("emailHash");

-- CreateIndex
CREATE INDEX "Customer_phoneHash_idx" ON "Customer"("phoneHash");

-- CreateIndex
CREATE INDEX "Customer_lastName_firstName_idx" ON "Customer"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "ConsentRecord_customerId_idx" ON "ConsentRecord"("customerId");

-- CreateIndex
CREATE INDEX "ConsentRecord_enrollmentId_idx" ON "ConsentRecord"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_slug_key" ON "Provider"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_providerId_slug_key" ON "Plan"("providerId", "slug");

-- CreateIndex
CREATE INDEX "Plan_active_featured_idx" ON "Plan"("active", "featured");

-- CreateIndex
CREATE INDEX "PlanPriceHistory_planId_changedAt_idx" ON "PlanPriceHistory"("planId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceArea_providerId_zip_key" ON "ServiceArea"("providerId", "zip");

-- CreateIndex
CREATE INDEX "ServiceArea_zip_idx" ON "ServiceArea"("zip");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralSource_code_key" ON "ReferralSource"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_code_key" ON "Campaign"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Property_slug_key" ON "Property"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyUnit_propertyId_unitNumber_key" ON "PropertyUnit"("propertyId", "unitNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentSession_tokenHash_key" ON "EnrollmentSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentSession_enrollmentId_key" ON "EnrollmentSession"("enrollmentId");

-- CreateIndex
CREATE INDEX "EnrollmentSession_createdAt_idx" ON "EnrollmentSession"("createdAt");

-- CreateIndex
CREATE INDEX "EnrollmentSession_propertyId_idx" ON "EnrollmentSession"("propertyId");

-- CreateIndex
CREATE INDEX "EnrollmentSession_zip_idx" ON "EnrollmentSession"("zip");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_publicId_key" ON "Enrollment"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_idempotencyKey_key" ON "Enrollment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Enrollment_status_submittedAt_idx" ON "Enrollment"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "Enrollment_assignedAgentId_status_idx" ON "Enrollment"("assignedAgentId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_propertyId_idx" ON "Enrollment"("propertyId");

-- CreateIndex
CREATE INDEX "Enrollment_providerId_idx" ON "Enrollment"("providerId");

-- CreateIndex
CREATE INDEX "Enrollment_planId_idx" ON "Enrollment"("planId");

-- CreateIndex
CREATE INDEX "Enrollment_createdAt_idx" ON "Enrollment"("createdAt");

-- CreateIndex
CREATE INDEX "Enrollment_customerId_idx" ON "Enrollment"("customerId");

-- CreateIndex
CREATE INDEX "EnrollmentStatusHistory_enrollmentId_createdAt_idx" ON "EnrollmentStatusHistory"("enrollmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentAssignment_enrollmentId_idx" ON "AgentAssignment"("enrollmentId");

-- CreateIndex
CREATE INDEX "AgentAssignment_agentId_active_idx" ON "AgentAssignment"("agentId", "active");

-- CreateIndex
CREATE INDEX "Message_enrollmentId_createdAt_idx" ON "Message"("enrollmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentNote_enrollmentId_createdAt_idx" ON "AgentNote"("enrollmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccessToken_tokenHash_key" ON "CustomerAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerAccessToken_enrollmentId_idx" ON "CustomerAccessToken"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "CustomerSession"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerSession_enrollmentId_idx" ON "CustomerSession"("enrollmentId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorStaffId_createdAt_idx" ON "AuditLog"("actorStaffId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_enrollmentId_createdAt_idx" ON "AuditLog"("enrollmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "RealtimeEvent_channel_id_idx" ON "RealtimeEvent"("channel", "id");

-- CreateIndex
CREATE INDEX "RealtimeEvent_createdAt_idx" ON "RealtimeEvent"("createdAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailLog_enrollmentId_idx" ON "EmailLog"("enrollmentId");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPriceHistory" ADD CONSTRAINT "PlanPriceHistory_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPriceHistory" ADD CONSTRAINT "PlanPriceHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceArea" ADD CONSTRAINT "ServiceArea_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_defaultProviderId_fkey" FOREIGN KEY ("defaultProviderId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_referralSourceId_fkey" FOREIGN KEY ("referralSourceId") REFERENCES "ReferralSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyUnit" ADD CONSTRAINT "PropertyUnit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSession" ADD CONSTRAINT "EnrollmentSession_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSession" ADD CONSTRAINT "EnrollmentSession_referralSourceId_fkey" FOREIGN KEY ("referralSourceId") REFERENCES "ReferralSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSession" ADD CONSTRAINT "EnrollmentSession_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSession" ADD CONSTRAINT "EnrollmentSession_selectedPlanId_fkey" FOREIGN KEY ("selectedPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSession" ADD CONSTRAINT "EnrollmentSession_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_referralSourceId_fkey" FOREIGN KEY ("referralSourceId") REFERENCES "ReferralSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentStatusHistory" ADD CONSTRAINT "EnrollmentStatusHistory_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentStatusHistory" ADD CONSTRAINT "EnrollmentStatusHistory_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAssignment" ADD CONSTRAINT "AgentAssignment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAssignment" ADD CONSTRAINT "AgentAssignment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAssignment" ADD CONSTRAINT "AgentAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_staffAuthorId_fkey" FOREIGN KEY ("staffAuthorId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentNote" ADD CONSTRAINT "AgentNote_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentNote" ADD CONSTRAINT "AgentNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccessToken" ADD CONSTRAINT "CustomerAccessToken_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

