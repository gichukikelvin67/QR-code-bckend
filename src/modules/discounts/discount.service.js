
import prisma from "../../config/database.js";
import { Prisma } from "@prisma/client";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toDecimal = (value) => new Prisma.Decimal(value);

const roundMoney = (value) =>
  value.toDecimalPlaces(2);

const ensureNoPaymentActivity = async (tx, billId) => {
  const payments = await tx.payment.findMany({
    where: {
      billId,
      status: {
        in: ["PENDING", "PROCESSING", "COMPLETED"],
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (payments.length > 0) {
    throw createError(
      "Discounts cannot be changed while payments are pending, processing, or completed.",
      409
    );
  }
};

const ensureEligibleBill = async (tx, restaurantId, billId) => {
  const bill = await tx.bill.findFirst({
    where: {
      id: billId,
      restaurantId,
    },
  });

  if (!bill) {
    throw createError("Bill not found.", 404);
  }

  if (bill.status !== "OPEN") {
    throw createError(
      "Discounts can only be applied to open bills.",
      409
    );
  }

  if (toDecimal(bill.amountPaid).greaterThan(0)) {
    throw createError(
      "Discounts cannot be changed after a payment has been made.",
      409
    );
  }

  await ensureNoPaymentActivity(tx, billId);

  return bill;
};

export const applyDiscount = async ({
  restaurantId,
  billId,
  type,
  value,
  reason,
  userId,
}) => {
  return prisma.$transaction(
    async (tx) => {
      const bill = await ensureEligibleBill(
        tx,
        restaurantId,
        billId
      );

      const discountValue = toDecimal(value);
      const subtotal = toDecimal(bill.subtotal);
      const existingDiscount = toDecimal(bill.discountAmount);

      const currentTotal = subtotal.minus(existingDiscount);

      if (!currentTotal.greaterThan(0)) {
        throw createError(
          "This bill has no remaining amount to discount."
        );
      }

      let discountAmount;

      if (type === "PERCENTAGE") {
        if (
          discountValue.lessThanOrEqualTo(0) ||
          discountValue.greaterThan(100)
        ) {
          throw createError(
            "Percentage must be between 0 and 100."
          );
        }

        discountAmount = roundMoney(
          currentTotal.mul(discountValue).div(100)
        );
      } else if (type === "FIXED_AMOUNT") {
        if (discountValue.lessThanOrEqualTo(0)) {
          throw createError(
            "Discount amount must be greater than zero."
          );
        }

        discountAmount = roundMoney(discountValue);
      } else {
        throw createError("Invalid discount type.");
      }

      if (discountAmount.greaterThanOrEqualTo(currentTotal)) {
        throw createError(
          "The discount must leave a positive bill balance."
        );
      }

      const newDiscountTotal = existingDiscount.plus(
        discountAmount
      );

      const newBillTotal = subtotal.minus(newDiscountTotal);

      const newBalance = newBillTotal.minus(
        toDecimal(bill.amountPaid)
      );

      const discount = await tx.discount.create({
        data: {
          restaurantId,
          billId,
          type,
          value: discountValue,
          amount: discountAmount,
          reason,
          approvedBy: userId,
          appliedBy: userId,
        },
      });

      const updatedBill = await tx.bill.update({
        where: {
          id: billId,
        },
        data: {
          discountAmount: newDiscountTotal,
          total: newBillTotal,
          balance: newBalance,
        },
      });

      return {
        discount,
        bill: updatedBill,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
};

export const reverseDiscount = async ({
  restaurantId,
  discountId,
  reason,
  userId,
}) => {
  return prisma.$transaction(
    async (tx) => {
      const discount = await tx.discount.findFirst({
        where: {
          id: discountId,
          restaurantId,
        },
        include: {
          bill: true,
        },
      });

      if (!discount) {
        throw createError("Discount not found.", 404);
      }

      if (discount.status !== "APPLIED") {
        throw createError(
          "This discount has already been reversed.",
          409
        );
      }

      const bill = await ensureEligibleBill(
        tx,
        restaurantId,
        discount.billId
      );

      const currentDiscountTotal = toDecimal(
        bill.discountAmount
      );

      const newDiscountTotal = currentDiscountTotal.minus(
        toDecimal(discount.amount)
      );

      if (newDiscountTotal.lessThan(0)) {
        throw createError(
          "Discount totals are inconsistent. Manual review is required.",
          409
        );
      }

      const newBillTotal = toDecimal(bill.subtotal).minus(
        newDiscountTotal
      );

      const newBalance = newBillTotal.minus(
        toDecimal(bill.amountPaid)
      );

      const updatedDiscount = await tx.discount.update({
        where: {
          id: discountId,
        },
        data: {
          status: "REVERSED",
          reversedBy: userId,
          reversedAt: new Date(),
          reversalReason: reason,
        },
      });

      const updatedBill = await tx.bill.update({
        where: {
          id: bill.id,
        },
        data: {
          discountAmount: newDiscountTotal,
          total: newBillTotal,
          balance: newBalance,
          status: "OPEN",
        },
      });

      return {
        discount: updatedDiscount,
        bill: updatedBill,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
};

export const listBillDiscounts = async ({
  restaurantId,
  billId,
}) => {
  const bill = await prisma.bill.findFirst({
    where: {
      id: billId,
      restaurantId,
    },
    select: {
      id: true,
    },
  });

  if (!bill) {
    throw createError("Bill not found.", 404);
  }

  return prisma.discount.findMany({
    where: {
      restaurantId,
      billId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const getDiscountById = async ({
  restaurantId,
  discountId,
}) => {
  const discount = await prisma.discount.findFirst({
    where: {
      id: discountId,
      restaurantId,
    },
    include: {
      bill: true,
    },
  });

  if (!discount) {
    throw createError("Discount not found.", 404);
  }

  return discount;
};
