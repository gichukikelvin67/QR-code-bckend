
import prisma from "../config/database.js";
import { reconcileMpesaPayment } from "../modules/payments/mpesa.service.js";

const INTERVAL_MS = 60 * 1000;
const BATCH_SIZE = 20;

let interval = null;
let isRunning = false;

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

        console.log(
          `[M-PESA JOB] Payment ${payment.id}:`,
          result.payment?.status || "UNKNOWN"
        );
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

  // Run once immediately.
  void runMpesaReconciliation();

  // Continue checking every 60 seconds.
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
