-- CreateEnum
CREATE TYPE "PreparationStation" AS ENUM ('KITCHEN', 'BAR');

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "station" "PreparationStation" NOT NULL DEFAULT 'KITCHEN';
