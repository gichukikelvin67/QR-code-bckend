-- CreateEnum
CREATE TYPE "PreparationStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'SERVED');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "preparationStatus" "PreparationStatus" NOT NULL DEFAULT 'PENDING';
