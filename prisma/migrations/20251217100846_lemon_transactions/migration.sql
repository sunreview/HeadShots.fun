/*
  Warnings:

  - You are about to alter the column `amount` on the `lemon_transactions` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - A unique constraint covering the columns `[localTxnId]` on the table `lemon_transactions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `localTxnId` to the `lemon_transactions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "lemon_transactions_lemonOrderId_idx";

-- AlterTable
ALTER TABLE "lemon_transactions" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "localTxnId" TEXT NOT NULL,
ALTER COLUMN "lemonOrderId" DROP NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);

-- CreateIndex
CREATE UNIQUE INDEX "lemon_transactions_localTxnId_key" ON "lemon_transactions"("localTxnId");
