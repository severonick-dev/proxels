-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('ru', 'en');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('pending', 'active', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'waiting_for_capture', 'succeeded', 'canceled');

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('online', 'offline', 'degraded');

-- CreateEnum
CREATE TYPE "LegalDocSlug" AS ENUM ('privacy', 'offer', 'cookie');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" TEXT,
    "passwordResetToken" TEXT,
    "passwordResetExpiresAt" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "locale" "Locale" NOT NULL DEFAULT 'ru',
    "consentPdnAt" TIMESTAMP(3),
    "consentPdnVersion" TEXT,
    "totpSecret" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceRub" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "trafficLimitGb" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'pending',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "subToken" TEXT NOT NULL,
    "subTokenRotatedAt" TIMESTAMP(3),
    "trafficUsedBytes" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "yookassaId" TEXT NOT NULL,
    "amountRub" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "receiptSent" BOOLEAN NOT NULL DEFAULT false,
    "offerAcceptedVersion" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "xrayApiAddr" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "inboundTag" TEXT NOT NULL DEFAULT 'vless-reality',
    "status" "NodeStatus" NOT NULL DEFAULT 'offline',
    "weight" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XrayClient" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XrayClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDoc" (
    "id" TEXT NOT NULL,
    "slug" "LegalDocSlug" NOT NULL,
    "title" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerifyToken_key" ON "User"("emailVerifyToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "Plan_isActive_sortOrder_idx" ON "Plan"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_subToken_key" ON "Subscription"("subToken");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_endAt_idx" ON "Subscription"("status", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_yookassaId_key" ON "Payment"("yookassaId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Node_name_key" ON "Node"("name");

-- CreateIndex
CREATE INDEX "Node_status_isActive_idx" ON "Node"("status", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "XrayClient_uuid_key" ON "XrayClient"("uuid");

-- CreateIndex
CREATE INDEX "XrayClient_nodeId_idx" ON "XrayClient"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "XrayClient_subscriptionId_nodeId_key" ON "XrayClient"("subscriptionId", "nodeId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "LegalDoc_slug_publishedAt_idx" ON "LegalDoc"("slug", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDoc_slug_version_key" ON "LegalDoc"("slug", "version");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayClient" ADD CONSTRAINT "XrayClient_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayClient" ADD CONSTRAINT "XrayClient_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
