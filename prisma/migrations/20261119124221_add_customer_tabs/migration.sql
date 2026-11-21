-- CreateEnum
CREATE TYPE "CustomerTabStatus" AS ENUM ('OPEN', 'CLOSED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "tabId" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "allowCredit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CustomerTab" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tabNumber" TEXT NOT NULL,
    "status" "CustomerTabStatus" NOT NULL DEFAULT 'OPEN',
    "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "openedBy" TEXT NOT NULL,
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerTab_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerTab_restaurantId_status_createdAt_idx" ON "CustomerTab"("restaurantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerTab_customerId_status_idx" ON "CustomerTab"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerTab_restaurantId_tabNumber_key" ON "CustomerTab"("restaurantId", "tabNumber");

-- CreateIndex
CREATE INDEX "Bill_tabId_status_idx" ON "Bill"("tabId", "status");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "CustomerTab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTab" ADD CONSTRAINT "CustomerTab_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTab" ADD CONSTRAINT "CustomerTab_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
