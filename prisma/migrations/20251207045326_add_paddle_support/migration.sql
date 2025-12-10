/*
  Warnings:

  - You are about to drop the `stripe_transactions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "stripe_transactions" DROP CONSTRAINT "stripe_transactions_userId_fkey";

-- DropTable
DROP TABLE "stripe_transactions";

-- CreateTable
CREATE TABLE "paddle_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paddleTransactionId" TEXT NOT NULL,
    "paddlePaymentId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "credits" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paddle_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paddle_transactions_paddleTransactionId_key" ON "paddle_transactions"("paddleTransactionId");

-- CreateIndex
CREATE INDEX "paddle_transactions_userId_idx" ON "paddle_transactions"("userId");

-- CreateIndex
CREATE INDEX "paddle_transactions_paddleTransactionId_idx" ON "paddle_transactions"("paddleTransactionId");

-- AddForeignKey
ALTER TABLE "paddle_transactions" ADD CONSTRAINT "paddle_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
