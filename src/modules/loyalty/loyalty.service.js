
import prisma from "../../config/database.js";
import { Prisma } from "@prisma/client";
import { createAuditLog } from "../audits/audit.service.js";

const POINTS_PER_100_KES = 1;
const KES_PER_POINT = 1;
const MINIMUM_REDEMPTION_POINTS = 50;

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const assertRole = (userRole, allowedRoles) => {
  if (!allowedRoles.includes(userRole)) {
    throw createError(
      "You are not authorized to perform this loyalty operation.",
      403
    );
  }
};

const getOrCreateAccount = async (tx, customerId) => {
  return tx.loyaltyAccount.upsert({
    where: { customerId },
    create: { customerId },
    update: {},
  });
};

// 1. Award points after a verified completed payment
export const awardPointsForPayment = async ({
  restaurantId,
  paymentId,
}) => {
  return prisma.$transaction(
    async (tx) => {
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

      if (payment.status !== "COMPLETED" || !payment.verifiedAt) {
        throw createError(
          "Points can only be awarded for verified completed payments.",
          409
        );
      }

      const customerId = payment.bill.customerId;

      if (!customerId) {
        return {
          awarded: false,
          message: "This bill is not linked to a customer.",
        };
      }

      const customer = await tx.customer.findFirst({
        where: {
          id: customerId,
          restaurantId,
          isActive: true,
        },
      });

      if (!customer) {
        throw createError("Customer not found or inactive.", 404);
      }

      const points = Math.floor(
        Number(payment.amount) / 100
      ) * POINTS_PER_100_KES;

      if (points <= 0) {
        return {
          awarded: false,
          points: 0,
          message: "Payment does not qualify for loyalty points.",
        };
      }

      const account = await getOrCreateAccount(tx, customer.id);

      if (!account.isActive) {
        return {
          awarded: false,
          message: "The customer's loyalty account is inactive.",
        };
      }

      const idempotencyKey = `PAYMENT:${payment.id}`;

      const existing = await tx.loyaltyTransaction.findUnique({
        where: {
          accountId_idempotencyKey: {
            accountId: account.id,
            idempotencyKey,
          },
        },
      });

      if (existing) {
        return {
          awarded: false,
          duplicate: true,
          transaction: existing,
        };
      }

      const updatedAccount = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          pointsBalance: {
            increment: points,
          },
        },
      });

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          billId: payment.billId,
          type: "EARN",
          points,
          description: `Points earned from payment ${payment.id}`,
          idempotencyKey,
        },
      });

      await createAuditLog({
        tx,
        restaurantId,
        userId: null,
        action: "LOYALTY_POINTS_EARNED",
        resource: "LOYALTY_ACCOUNT",
        resourceId: account.id,
        description: `Awarded ${points} loyalty points for a verified payment.`,
        metadata: {
          customerId: customer.id,
          paymentId: payment.id,
          billId: payment.billId,
          pointsAwarded: points,
          paymentAmount: payment.amount.toString(),
          resultingBalance: updatedAccount.pointsBalance,
          loyaltyTransactionId: transaction.id,
        },
      });

      return {
        awarded: true,
        points,
        balance: updatedAccount.pointsBalance,
        transaction,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
};

// 2. Redeem points against an open bill
export const redeemPoints = async ({
  restaurantId,
  customerId,
  billId,
  points,
  idempotencyKey,
  userId,
  userRole,
}) => {
  assertRole(userRole, [
    "OWNER",
    "ADMIN",
    "MANAGER",
    "CASHIER",
    "WAITER",
  ]);

  return prisma.$transaction(
    async (tx) => {
      const customer = await tx.customer.findFirst({
        where: {
          id: customerId,
          restaurantId,
          isActive: true,
        },
      });

      if (!customer) {
        throw createError("Customer not found or inactive.", 404);
      }

      const account = await getOrCreateAccount(tx, customer.id);

      if (!account.isActive) {
        throw createError("This loyalty account is inactive.", 409);
      }

      const existing = await tx.loyaltyTransaction.findUnique({
        where: {
          accountId_idempotencyKey: {
            accountId: account.id,
            idempotencyKey,
          },
        },
      });

      if (existing) {
        if (
          existing.type !== "REDEEM" ||
          existing.billId !== billId ||
          existing.points !== -points
        ) {
          throw createError(
            "This idempotency key was already used for a different transaction.",
            409
          );
        }

        return {
          duplicate: true,
          transaction: existing,
          balance: account.pointsBalance,
        };
      }

      if (points < MINIMUM_REDEMPTION_POINTS) {
        throw createError(
          `At least ${MINIMUM_REDEMPTION_POINTS} points are required for redemption.`
        );
      }

      if (account.pointsBalance < points) {
        throw createError("Insufficient loyalty points.", 409);
      }

      const bill = await tx.bill.findFirst({
        where: {
          id: billId,
          restaurantId,
          customerId,
        },
      });

      if (!bill) {
        throw createError(
          "Bill not found or does not belong to this customer.",
          404
        );
      }

      if (bill.status !== "OPEN" || Number(bill.amountPaid) > 0) {
        throw createError(
          "Points can only be redeemed against an unpaid open bill.",
          409
        );
      }

      const pendingPayments = await tx.payment.count({
        where: {
          billId,
          status: {
            in: ["PENDING", "PROCESSING"],
          },
        },
      });

      if (pendingPayments > 0) {
        throw createError(
          "Points cannot be redeemed while a payment is pending.",
          409
        );
      }

      const redemptionValue = new Prisma.Decimal(
        points * KES_PER_POINT
      );

      const currentTotal = new Prisma.Decimal(bill.total);

      if (redemptionValue.greaterThanOrEqualTo(currentTotal)) {
        throw createError(
          "Redemption must leave a positive bill total."
        );
      }

      const newDiscountAmount = new Prisma.Decimal(
        bill.discountAmount
      ).plus(redemptionValue);

      const newTotal = currentTotal.minus(redemptionValue);

      const updatedAccount = await tx.loyaltyAccount.updateMany({
        where: {
          id: account.id,
          pointsBalance: { gte: points },
        },
        data: {
          pointsBalance: {
            decrement: points,
          },
        },
      });

      if (updatedAccount.count !== 1) {
        throw createError(
          "Loyalty balance changed. Refresh and try again.",
          409
        );
      }

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          billId,
          type: "REDEEM",
          points: -points,
          description: `Redeemed ${points} points against bill ${bill.billNumber}`,
          idempotencyKey,
          performedBy: userId,
        },
      });

      await tx.bill.update({
        where: { id: billId },
        data: {
          discountAmount: newDiscountAmount,
          total: newTotal,
          balance: newTotal,
        },
      });

      await createAuditLog({
        tx,
        restaurantId,
        userId,
        action: "LOYALTY_POINTS_REDEEMED",
        resource: "LOYALTY_ACCOUNT",
        resourceId: account.id,
        description: `Redeemed ${points} loyalty points against bill ${bill.billNumber}.`,
        metadata: {
          customerId,
          billId,
          pointsRedeemed: points,
          discountValue: redemptionValue.toFixed(2),
          previousBalance: account.pointsBalance,
          resultingBalance: account.pointsBalance - points,
        },
      });

      return {
        transaction,
        pointsRedeemed: points,
        discountValue: redemptionValue.toFixed(2),
        pointsBalance: account.pointsBalance - points,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
};

// 3. Manager-authorized points adjustment
export const adjustCustomerPoints = async ({
  restaurantId,
  customerId,
  points,
  description,
  idempotencyKey,
  userId,
  userRole,
}) => {
  assertRole(userRole, ["OWNER", "ADMIN", "MANAGER"]);

  return prisma.$transaction(
    async (tx) => {
      const customer = await tx.customer.findFirst({
        where: {
          id: customerId,
          restaurantId,
          isActive: true,
        },
      });

      if (!customer) {
        throw createError("Customer not found or inactive.", 404);
      }

      const account = await getOrCreateAccount(tx, customer.id);

      if (!account.isActive) {
        throw createError("This loyalty account is inactive.", 409);
      }

      const existing = await tx.loyaltyTransaction.findUnique({
        where: {
          accountId_idempotencyKey: {
            accountId: account.id,
            idempotencyKey,
          },
        },
      });

      if (existing) {
        if (
          existing.type !== "ADJUSTMENT" ||
          existing.points !== points
        ) {
          throw createError(
            "This idempotency key was already used for another transaction.",
            409
          );
        }

        return {
          duplicate: true,
          transaction: existing,
          balance: account.pointsBalance,
        };
      }

      if (account.pointsBalance + points < 0) {
        throw createError(
          "Adjustment would make the points balance negative.",
          409
        );
      }

      const updatedAccount = await tx.loyaltyAccount.updateMany({
        where: {
          id: account.id,
          pointsBalance: { gte: Math.max(0, -points) },
        },
        data: {
          pointsBalance: {
            increment: points,
          },
        },
      });

      if (updatedAccount.count !== 1) {
        throw createError(
          "Loyalty balance changed. Refresh and try again.",
          409
        );
      }

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          type: "ADJUSTMENT",
          points,
          description,
          idempotencyKey,
          performedBy: userId,
        },
      });

      await createAuditLog({
        tx,
        restaurantId,
        userId,
        action: "LOYALTY_POINTS_ADJUSTED",
        resource: "LOYALTY_ACCOUNT",
        resourceId: account.id,
        description: `Manually adjusted customer loyalty points by ${points}.`,
        metadata: {
          customerId,
          pointsAdjusted: points,
          adjustmentDescription: description,
          previousBalance: account.pointsBalance,
          resultingBalance: account.pointsBalance + points,
          transactionId: transaction.id,
        },
      });

      return {
        transaction,
        pointsBalance: account.pointsBalance + points,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
};

// 4. Loyalty transaction history
export const getCustomerLoyaltyHistory = async ({
  restaurantId,
  customerId,
}) => {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      restaurantId,
    },
    include: {
      loyaltyAccount: {
        include: {
          transactions: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      },
    },
  });

  if (!customer) {
    throw createError("Customer not found.", 404);
  }

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
    },
    pointsBalance: customer.loyaltyAccount?.pointsBalance ?? 0,
    transactions: customer.loyaltyAccount?.transactions ?? [],
  };
};

/**
 * Reverse loyalty points proportionally when a refund is completed.
 *
 * Must be called inside the same Prisma transaction that completes
 * the refund. The current refund must already have status COMPLETED
 * within that transaction.
 */
export const reversePointsForRefund = async ({
  tx,
  restaurantId,
  payment,
  refund,
  userId,
}) => {
  if (!tx || !payment || !refund) {
    throw createError("Refund reversal is missing required data.");
  }

  if (
    payment.restaurantId !== restaurantId ||
    refund.restaurantId !== restaurantId ||
    refund.paymentId !== payment.id
  ) {
    throw createError(
      "Refund and payment do not belong to this restaurant.",
      403
    );
  }

  if (refund.status !== "COMPLETED") {
    throw createError(
      "Only completed refunds can reverse loyalty points.",
      409
    );
  }

  const customerId = payment.bill?.customerId;

  if (!customerId) {
    return {
      reversed: false,
      message: "The bill is not linked to a customer.",
    };
  }

  const account = await tx.loyaltyAccount.findUnique({
    where: { customerId },
  });

  if (!account) {
    return {
      reversed: false,
      message: "No loyalty account exists for this customer.",
    };
  }

  const earningTransaction = await tx.loyaltyTransaction.findUnique({
    where: {
      accountId_idempotencyKey: {
        accountId: account.id,
        idempotencyKey: `PAYMENT:${payment.id}`,
      },
    },
  });

  if (!earningTransaction || earningTransaction.type !== "EARN") {
    return {
      reversed: false,
      message: "No loyalty points were earned from this payment.",
    };
  }

  const earnedPoints = earningTransaction.points;

  if (earnedPoints <= 0) {
    return {
      reversed: false,
      message: "The original earning transaction has no reversible points.",
    };
  }

  const completedRefunds = await tx.refund.aggregate({
    where: {
      restaurantId,
      paymentId: payment.id,
      status: "COMPLETED",
    },
    _sum: {
      amount: true,
    },
  });

  const cumulativeRefund = new Prisma.Decimal(
    completedRefunds._sum.amount || 0
  );

  const originalPaymentAmount = new Prisma.Decimal(payment.amount);

  if (!originalPaymentAmount.greaterThan(0)) {
    throw createError("Original payment amount is invalid.", 409);
  }

  if (cumulativeRefund.greaterThan(originalPaymentAmount)) {
    throw createError(
      "Completed refunds exceed the original payment amount.",
      409
    );
  }

  const targetReversal = cumulativeRefund.equals(originalPaymentAmount)
    ? earnedPoints
    : new Prisma.Decimal(earnedPoints)
        .mul(cumulativeRefund)
        .div(originalPaymentAmount)
        .floor()
        .toNumber();

  const reversalPrefix = `PAYMENT_REFUND:${payment.id}:`;

  const existingReversals = await tx.loyaltyTransaction.aggregate({
    where: {
      accountId: account.id,
      type: "REVERSAL",
      idempotencyKey: {
        startsWith: reversalPrefix,
      },
    },
    _sum: {
      points: true,
    },
  });

  const alreadyReversed = Math.abs(
    existingReversals._sum.points || 0
  );

  const pointsToReverse = Math.min(
    earnedPoints - alreadyReversed,
    Math.max(0, targetReversal - alreadyReversed)
  );

  if (pointsToReverse <= 0) {
    return {
      reversed: false,
      duplicate: true,
      message: "The required loyalty points have already been reversed.",
      pointsReversed: 0,
    };
  }

  const idempotencyKey = `${reversalPrefix}${refund.id}`;

  const existingReversal = await tx.loyaltyTransaction.findUnique({
    where: {
      accountId_idempotencyKey: {
        accountId: account.id,
        idempotencyKey,
      },
    },
  });

  if (existingReversal) {
    return {
      reversed: false,
      duplicate: true,
      transaction: existingReversal,
    };
  }

  // A refund can create a negative points balance if previously
  // earned points have already been spent.
  const updatedAccount = await tx.loyaltyAccount.update({
    where: { id: account.id },
    data: {
      pointsBalance: {
        decrement: pointsToReverse,
      },
    },
  });

  const transaction = await tx.loyaltyTransaction.create({
    data: {
      accountId: account.id,
      billId: payment.billId,
      type: "REVERSAL",
      points: -pointsToReverse,
      description: `Reversed ${pointsToReverse} points following refund ${refund.id}`,
      idempotencyKey,
      performedBy: userId || null,
    },
  });

  await createAuditLog({
    tx,
    restaurantId,
    userId: userId || null,
    action: "LOYALTY_POINTS_REVERSED",
    resource: "LOYALTY_ACCOUNT",
    resourceId: account.id,
    description: `Reversed ${pointsToReverse} loyalty points following a completed refund.`,
    metadata: {
      customerId,
      paymentId: payment.id,
      refundId: refund.id,
      originalPointsEarned: earnedPoints,
      cumulativeRefund: cumulativeRefund.toFixed(2),
      originalPaymentAmount: originalPaymentAmount.toFixed(2),
      pointsReversed: pointsToReverse,
      resultingBalance: updatedAccount.pointsBalance,
    },
  });

  return {
    reversed: true,
    pointsReversed: pointsToReverse,
    pointsBalance: updatedAccount.pointsBalance,
    transaction,
  };
};
