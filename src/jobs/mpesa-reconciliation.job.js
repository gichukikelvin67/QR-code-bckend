
import prisma from "../config/database.js";
import { createAuditLog } from "../modules/audits/audit.service.js";
import { reconcileMpesaPayment } from "../modules/payments/mpesa.service.js";

const INTERVAL_MS = 60 * 1000;
const BATCH_SIZE = 20;

let interval = null;
let isRunning = false;

const recordReconciliationAudit = async ({
  payment,
  action,
  previousStatus,
  newStatus,
  description,
}) => {
  try {
    await createAuditLog({
      restaurantId: payment.restaurantId,
      userId: null,
      action,
      resource: "PAYMENT",
      resourceId: payment.id,
      description,
      metadata: {
        paymentMethod: "MPESA",
        verificationMethod: "STK_QUERY",
        previousStatus,
        newStatus,
        source: "AUTOMATED_RECONCILIATION_JOB",
      },
    });
  } catch (error) {
    console.error(
      `[M-PESA JOB] Audit logging failed for payment ${payment.id}:`,
      error.message
    );
  }
};

const runMpesaReconciliation = async () => {
  if (isRunning) return;

  isRunning = true;

  try {
    const payments = await prisma.payment.findMany({
      where: {
        method: "MPESA",
        status: {
          in: ["PENDING", "PROCESSING"],
        },
        checkoutRequestId: {
          not: null,
        },
        darajaTimestamp: {
          not: null,
        },
      },
      select: {
        id: true,
        restaurantId: true,
        status: true,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: BATCH_SIZE,
    });

    if (payments.length === 0) {
      return;
    }

    console.log(
      `[M-PESA JOB] Reconciling ${payments.length} pending payments`
    );

    for (const payment of payments) {
      try {
        const result = await reconcileMpesaPayment({
          restaurantId: payment.restaurantId,
          paymentId: payment.id,
        });

        const newStatus = result.payment?.status || "UNKNOWN";

        console.log(
          `[M-PESA JOB] Payment ${payment.id}:`,
          newStatus
        );

        // Only audit meaningful status changes.
        if (newStatus === payment.status) {
          continue;
        }

        if (newStatus === "COMPLETED") {
          await recordReconciliationAudit({
            payment,
            action: "MPESA_RECONCILIATION_COMPLETED",
            previousStatus: payment.status,
            newStatus,
            description:
              "Automated reconciliation confirmed an M-Pesa payment.",
          });
        } else if (newStatus === "FAILED") {
          await recordReconciliationAudit({
            payment,
            action: "MPESA_RECONCILIATION_FAILED",
            previousStatus: payment.status,
            newStatus,
            description:
              "Automated reconciliation confirmed an unsuccessful M-Pesa payment.",
          });
        } else if (newStatus === "REVERSED") {
          await recordReconciliationAudit({
            payment,
            action: "MPESA_PAYMENT_REVERSED",
            previousStatus: payment.status,
            newStatus,
            description:
              "Automated reconciliation detected a reversed M-Pesa payment.",
          });
        }
      } catch (error) {
        console.error(
          `[M-PESA JOB] Failed to reconcile payment ${payment.id}:`,
          error.message
        );
      }
    }
  } catch (error) {
    console.error(
      "[M-PESA JOB] Reconciliation job failed:",
      error
    );
  } finally {
    isRunning = false;
  }
};

export const startMpesaReconciliationJob = () => {
  if (interval) {
    console.log("[M-PESA JOB] Already running");
    return;
  }

  console.log("[M-PESA JOB] Starting reconciliation worker");

  void runMpesaReconciliation();

  interval = setInterval(() => {
    void runMpesaReconciliation();
  }, INTERVAL_MS);
};

export const stopMpesaReconciliationJob = () => {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }

  console.log("[M-PESA JOB] Reconciliation worker stopped");
};
