-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "DiscountStatus" AS ENUM ('APPLIED', 'REVERSED');

-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DiscountStatus" NOT NULL DEFAULT 'APPLIED',
    "approvedBy" TEXT NOT NULL,
    "appliedBy" TEXT NOT NULL,
    "reversedBy" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Discount_restaurantId_createdAt_idx" ON "Discount"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "Discount_billId_status_idx" ON "Discount"("billId", "status");

-- CreateIndex
CREATE INDEX "Discount_approvedBy_idx" ON "Discount"("approvedBy");

-- CreateIndex
CREATE INDEX "Discount_appliedBy_idx" ON "Discount"("appliedBy");

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
