-- CreateTable
CREATE TABLE "PaymentCallbackEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "checkoutRequestId" TEXT NOT NULL,
    "resultCode" TEXT,
    "resultDesc" TEXT,
    "payload" JSONB NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
    "processingError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentCallbackEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentCallbackEvent_checkoutRequestId_receivedAt_idx" ON "PaymentCallbackEvent"("checkoutRequestId", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentCallbackEvent_paymentId_receivedAt_idx" ON "PaymentCallbackEvent"("paymentId", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentCallbackEvent_processingStatus_receivedAt_idx" ON "PaymentCallbackEvent"("processingStatus", "receivedAt");

-- AddForeignKey
ALTER TABLE "PaymentCallbackEvent" ADD CONSTRAINT "PaymentCallbackEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
