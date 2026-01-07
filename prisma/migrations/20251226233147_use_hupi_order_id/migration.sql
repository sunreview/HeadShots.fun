/*
  Warnings:

  - A unique constraint covering the columns `[hupiOrderId]` on the table `hupi_transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "hupi_transactions" ADD COLUMN     "hupiOrderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "hupi_transactions_hupiOrderId_key" ON "hupi_transactions"("hupiOrderId");
