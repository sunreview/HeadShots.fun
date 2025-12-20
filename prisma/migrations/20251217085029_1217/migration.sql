/*
  Warnings:

  - You are about to drop the `paddle_transactions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "paddle_transactions" DROP CONSTRAINT "paddle_transactions_userId_fkey";

-- DropTable
DROP TABLE "paddle_transactions";

-- CreateTable
CREATE TABLE "lemon_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lemonOrderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "credits" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lemon_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lemon_transactions_lemonOrderId_key" ON "lemon_transactions"("lemonOrderId");

-- CreateIndex
CREATE INDEX "lemon_transactions_userId_idx" ON "lemon_transactions"("userId");

-- CreateIndex
CREATE INDEX "lemon_transactions_lemonOrderId_idx" ON "lemon_transactions"("lemonOrderId");

-- AddForeignKey
ALTER TABLE "lemon_transactions" ADD CONSTRAINT "lemon_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
