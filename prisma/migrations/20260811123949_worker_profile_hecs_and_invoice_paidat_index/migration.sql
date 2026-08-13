-- AlterTable
ALTER TABLE "WorkerProfile" ADD COLUMN     "hasHecsDebt" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Invoice_userId_paidAt_idx" ON "Invoice"("userId", "paidAt");

