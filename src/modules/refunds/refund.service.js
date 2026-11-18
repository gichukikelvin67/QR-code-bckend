
import prisma from "../../config/database.js";
import { Prisma } from "@prisma/client";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const decimal = (value) => new Prisma.Decimal(value);

const roundMoney = (value) => value.toDecimalPlaces(2);

const activeRefundStatuses = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
];

// 1. Request a refund
export const requestRefund = async ({
  restaurantId,
  paymentId,
  amount,
  reason,
  idempotencyKey,
  userId,
}) => {
  return prisma.$transaction(
    async (tx) => {
      const requestedAmount = decimal(amount);

      const existingRefund = await tx.refund.findUnique({
        where: {
          restaurantId_idempotencyKey: {
            restaurantId,
            idempotencyKey,
          },
        },
      });

      if (existingRefund) {
        const sameRequest =
          existingRefund.paymentId === paymentId &&
          decimal(existingRefund.amount).equals(requestedAmount) &&
          existingRefund.reason === reason &&
          existingRefund.requestedBy === userId;

        if (!sameRequest) {
          throw createError(
            "This idempotency key was already used for a different refund request.",
            409
          );
        }

        return existingRefund;
      }

      const payment = await tx.payment.findFirst({
        where: {
          id: paymentId,
          restaurantId,
        },
        include: {
          bill: true,
        },
      });

      if (!payment) {
        throw createError("Payment not found.", 404);
      }

      if (payment.status !== "COMPLETED") {
        throw createError(
          "Only completed payments can be refunded.",
          409
        );
      }

      if (!requestedAmount.greaterThan(0)) {
        throw createError(
          "Refund amount must be greater than zero."
        );
      }

      const existingTotals = await tx.refund.aggregate({
        where: {
          paymentId,
          restaurantId,
          status: {
            in: activeRefundStatuses,
          },
        },
        _sum: {
          amount: true,
        },
      });

      const alreadyReserved = decimal(
        existingTotals._sum.amount || 0
      );

      const refundableBalance = decimal(payment.amount).minus(
        alreadyReserved
      );

      if (requestedAmount.greaterThan(refundableBalance)) {
        throw createError(
          `Refund exceeds the remaining refundable amount of ${refundableBalance.toFixed(2)}.`,
          409
        );
      }

      const refund = await tx.refund.create({
        data: {
          restaurantId,
          paymentId,
          amount: roundMoney(requestedAmount),
          reason,
          idempotencyKey,
          requestedBy: userId,
          status: "PENDING",
        },
      });

      return refund;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
};

// 2. Approve a refund and move it into processing
export const approveRefund = async ({
  restaurantId,
  refundId,
  userId,
}) => {
  return prisma.$transaction(
    async (tx) => {
      const refund = await tx.refund.findFirst({
        where: {
          id: refundId,
          restaurantId,
        },
      });

      if (!refund) {
        throw createError("Refund not found.", 404);
      }

      if (refund.status !== "PENDING") {
        throw createError(
          "Only pending refunds can be approved.",
          409
        );
      }

      if (refund.requestedBy === userId) {
        throw createError(
          "The person requesting a refund cannot approve their own request.",
          403
        );
      }

      const result = await tx.refund.updateMany({
        where: {
          id: refundId,
          restaurantId,
          status: "PENDING",
        },
        data: {
          status: "PROCESSING",
          approvedBy: userId,
        },
      });

      if (result.count !== 1) {
        throw createError(
          "Refund status changed. Refresh and try again.",
          409
        );
      }

      return tx.refund.findUnique({
        where: {
          id: refundId,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
};

// 3. Confirm that money has actually been refunded
export const completeRefund = async ({
  restaurantId,
  refundId,
  providerReference,
}) => {
  return prisma.$transaction(
    async (tx) => {
      const refund = await tx.refund.findFirst({
        where: {
          id: refundId,
          restaurantId,
        },
        include: {
          payment: {
            include: {
              bill: true,
            },
          },
        },
      });

      if (!refund) {
        throw createError("Refund not found.", 404);
      }

      if (refund.status !== "PROCESSING") {
        throw createError(
          "Only processing refunds can be completed.",
          409
        );
      }

      if (!providerReference || !providerReference.trim()) {
        throw createError(
          "A transaction or confirmation reference is required."
        );
      }

      const payment = refund.payment;
      const bill = payment.bill;

      const completedRefunds = await tx.refund.aggregate({
        where: {
          paymentId: payment.id,
          restaurantId,
          status: "COMPLETED",
        },
        _sum: {
          amount: true,
        },
      });

      const alreadyRefunded = decimal(
        completedRefunds._sum.amount || 0
      );

      const newRefundedTotal = alreadyRefunded.plus(
        decimal(refund.amount)
      );

      if (newRefundedTotal.greaterThan(decimal(payment.amount))) {
        throw createError(
          "Completed refunds would exceed the original payment.",
          409
        );
      }

      const newAmountPaid = decimal(bill.amountPaid).minus(
        decimal(refund.amount)
      );

      if (newAmountPaid.lessThan(0)) {
        throw createError(
          "Refund exceeds the amount recorded as paid on this bill.",
          409
        );
      }

      const newBalance = roundMoney(
        decimal(bill.total).minus(newAmountPaid)
      );

      const newBillStatus = newBalance.equals(0)
        ? "PAID"
        : newAmountPaid.greaterThan(0)
          ? "PARTIALLY_PAID"
          : "OPEN";

      const result = await tx.refund.updateMany({
        where: {
          id: refundId,
          restaurantId,
          status: "PROCESSING",
        },
        data: {
          status: "COMPLETED",
          providerReference: providerReference.trim(),
          processedAt: new Date(),
        },
      });

      if (result.count !== 1) {
        throw createError(
          "Refund status changed. Refresh and try again.",
          409
        );
      }

      await tx.bill.update({
        where: {
          id: bill.id,
        },
        data: {
          amountPaid: roundMoney(newAmountPaid),
          balance: newBalance,
          status: newBillStatus,
        },
      });

      // Mark the original payment REVERSED only when
      // the entire payment amount has been refunded.
      if (newRefundedTotal.equals(decimal(payment.amount))) {
        await tx.payment.update({
          where: {
            id: payment.id,
          },
          data: {
            status: "REVERSED",
          },
        });
      }

      return tx.refund.findUnique({
        where: {
          id: refundId,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
};

// 4. Reject a refund request
export const rejectRefund = async ({
  restaurantId,
  refundId,
  reason,
  userId,
}) => {
  return prisma.$transaction(
    async (tx) => {
      const refund = await tx.refund.findFirst({
        where: {
          id: refundId,
          restaurantId,
        },
      });

      if (!refund) {
        throw createError("Refund not found.", 404);
      }

      if (refund.status !== "PENDING") {
        throw createError(
          "Only pending refunds can be rejected.",
          409
        );
      }

      if (refund.requestedBy === userId) {
        throw createError(
          "The person requesting a refund cannot reject their own request.",
          403
        );
      }

      const result = await tx.refund.updateMany({
        where: {
          id: refundId,
          restaurantId,
          status: "PENDING",
        },
        data: {
          status: "REJECTED",
          approvedBy: userId,
          rejectedAt: new Date(),
          rejectionReason: reason,
        },
      });

      if (result.count !== 1) {
        throw createError(
          "Refund status changed. Refresh and try again.",
          409
        );
      }

      return tx.refund.findUnique({
        where: {
          id: refundId,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
};

// 5. List refunds for a payment
export const listPaymentRefunds = async ({
  restaurantId,
  paymentId,
}) => {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      restaurantId,
    },
    select: {
      id: true,
    },
  });

  if (!payment) {
    throw createError("Payment not found.", 404);
  }

  return prisma.refund.findMany({
    where: {
      restaurantId,
      paymentId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

// 6. Get a refund by ID
export const getRefundById = async ({
  restaurantId,
  refundId,
}) => {
  const refund = await prisma.refund.findFirst({
    where: {
      id: refundId,
      restaurantId,
    },
    include: {
      payment: {
        include: {
          bill: true,
        },
      },
    },
  });

  if (!refund) {
    throw createError("Refund not found.", 404);
  }

  return refund;
};
