/*
  Warnings:

  - Made the column `hupiOrderId` on table `hupi_transactions` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "hupi_transactions" ALTER COLUMN "hupiTransactionId" DROP NOT NULL,
ALTER COLUMN "hupiOrderId" SET NOT NULL;
