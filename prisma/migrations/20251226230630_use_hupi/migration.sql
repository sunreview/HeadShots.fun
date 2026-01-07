/*
  Warnings:

  - You are about to drop the `paddle_transactions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "paddle_transactions" DROP CONSTRAINT "paddle_transactions_userId_fkey";

-- DropTable
DROP TABLE "paddle_transactions";

-- CreateTable
CREATE TABLE "hupi_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hupiTransactionId" TEXT NOT NULL,
    "hupiPaymentId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "credits" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hupi_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hupi_transactions_hupiTransactionId_key" ON "hupi_transactions"("hupiTransactionId");

-- CreateIndex
CREATE INDEX "hupi_transactions_userId_idx" ON "hupi_transactions"("userId");

-- CreateIndex
CREATE INDEX "hupi_transactions_hupiTransactionId_idx" ON "hupi_transactions"("hupiTransactionId");

-- AddForeignKey
ALTER TABLE "hupi_transactions" ADD CONSTRAINT "hupi_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
