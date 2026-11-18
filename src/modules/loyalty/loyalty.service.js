
import prisma from "../../config/database.js";
import { Prisma } from "@prisma/client";

const POINTS_PER_100_KES = 1;
const KES_PER_POINT = 1;
const MINIMUM_REDEMPTION_POINTS = 50;

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeKenyanPhone = (phone) => {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("254")) return `+${digits}`;
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;

  return `+${digits}`;
};

const getOrCreateAccount = async (tx, customerId) => {
  return tx.loyaltyAccount.upsert({
    where: { customerId },
    create: { customerId },
    update: {},
  });
};

// 1. Create a customer and loyalty account
export const createCustomer = async ({
  restaurantId,
  name,
  phone,
  email,
}) => {
  const normalizedPhone = normalizeKenyanPhone(phone);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.customer.findUnique({
      where: {
        restaurantId_phone: {
          restaurantId,
          phone: normalizedPhone,
        },
      },
    });

    if (existing) {
      throw createError(
        "A customer with this phone number already exists.",
        409
      );
    }

    const customer = await tx.customer.create({
      data: {
        restaurantId,
        name,
        phone: normalizedPhone,
        email: email || null,
        loyaltyAccount: {
          create: {},
        },
      },
      include: {
        loyaltyAccount: true,
      },
    });

    return customer;
  });
};

// 2. List restaurant customers
export const listCustomers = async ({ restaurantId }) => {
  return prisma.customer.findMany({
    where: { restaurantId },
    include: {
      loyaltyAccount: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

// 3. Get customer details
export const getCustomerById = async ({
  restaurantId,
  customerId,
}) => {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      restaurantId,
    },
    include: {
      loyaltyAccount: true,
    },
  });

  if (!customer) {
    throw createError("Customer not found.", 404);
  }

  return customer;
};

// 4. Update customer
export const updateCustomer = async ({
  restaurantId,
  customerId,
  data,
}) => {
  await getCustomerById({ restaurantId, customerId });

  const updateData = { ...data };

  if (updateData.phone) {
    updateData.phone = normalizeKenyanPhone(updateData.phone);
  }

  if (updateData.email === "") {
    updateData.email = null;
  }

  try {
    return await prisma.customer.update({
      where: { id: customerId },
      data: updateData,
      include: {
        loyaltyAccount: true,
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw createError(
        "A customer with this phone number already exists.",
        409
      );
    }
    throw error;
  }
};

// 5. Award points after a verified completed payment
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

// 6. Redeem points against an open bill
export const redeemPoints = async ({
  restaurantId,
  customerId,
  billId,
  points,
  idempotencyKey,
  userId,
}) => {
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

// 7. Manager-authorized points adjustment
export const adjustCustomerPoints = async ({
  restaurantId,
  customerId,
  points,
  description,
  idempotencyKey,
  userId,
}) => {
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

// 8. Loyalty transaction history
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
