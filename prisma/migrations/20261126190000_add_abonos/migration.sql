-- CreateEnum
CREATE TYPE "ConsortiumType" AS ENUM ('EDIFICIO', 'BARRIO_CERRADO', 'COUNTRY', 'OTRO');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'WAIVED');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "consortiumId" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "countsAgainstQuota" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "subscriptionId" TEXT;

-- CreateTable
CREATE TABLE "Consortium" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ConsortiumType" NOT NULL DEFAULT 'EDIFICIO',
    "cuit" TEXT,
    "address" TEXT,
    "locality" TEXT,
    "unitsCount" INTEGER,
    "administrator" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consortium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisoryPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyFee" DECIMAL(14,2) NOT NULL,
    "includedQueries" INTEGER,
    "overageFee" DECIMAL(14,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisoryPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "consortiumId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "monthlyFee" DECIMAL(14,2) NOT NULL,
    "includedQueries" INTEGER,
    "overageFee" DECIMAL(14,2),
    "dueDay" INTEGER NOT NULL DEFAULT 10,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paidAmount" DECIMAL(14,2),
    "paymentMethod" TEXT,
    "paymentRef" TEXT,
    "invoiceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Consortium_cuit_key" ON "Consortium"("cuit");

-- CreateIndex
CREATE INDEX "Consortium_name_idx" ON "Consortium"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AdvisoryPlan_name_key" ON "AdvisoryPlan"("name");

-- CreateIndex
CREATE INDEX "Subscription_consortiumId_idx" ON "Subscription"("consortiumId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Installment_dueDate_idx" ON "Installment"("dueDate");

-- CreateIndex
CREATE INDEX "Installment_status_idx" ON "Installment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Installment_subscriptionId_period_key" ON "Installment"("subscriptionId", "period");

-- CreateIndex
CREATE INDEX "Customer_consortiumId_idx" ON "Customer"("consortiumId");

-- CreateIndex
CREATE INDEX "Ticket_subscriptionId_createdAt_idx" ON "Ticket"("subscriptionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_consortiumId_fkey" FOREIGN KEY ("consortiumId") REFERENCES "Consortium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_consortiumId_fkey" FOREIGN KEY ("consortiumId") REFERENCES "Consortium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvisoryPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

