
import { randomBytes } from "node:crypto";
import prisma from "../../config/database.js";

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toCents(value) {
  const price = String(value);
  const [whole, fraction = ""] = price.split(".");
  const cents = `${fraction}00`.slice(0, 2);

  return BigInt(whole) * 100n + BigInt(cents);
}

function formatMoney(cents) {
  return `${cents / 100n}.${String(cents % 100n)
    .padStart(2, "0")}`;
}

function generateBillNumber() {
  const date = new Date();
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");

  const randomPart = randomBytes(4)
    .toString("hex")
    .toUpperCase();

  return `BILL-${datePart}-${randomPart}`;
}

export async function generateSessionBill({
  restaurantId,
  sessionId,
}) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const session = await tx.diningSession.findFirst({
          where: {
            id: sessionId,
            status: "OPEN",
            table: {
              is: {
                restaurantId,
              },
            },
          },
          select: {
            id: true,
            table: {
              select: {
                tableNumber: true,
              },
            },
            orders: {
              where: {
                status: {
                  not: "CANCELLED",
                },
              },
              select: {
                id: true,
                orderNumber: true,
                items: {
                  select: {
                    id: true,
                    itemName: true,
                    quantity: true,
                    unitPrice: true,
                  },
                },
              },
            },
          },
        });

        if (!session) {
          throw createError(
            "Open dining session not found for this restaurant.",
            404
          );
        }

        const allOrderItems = session.orders.flatMap(
          (order) => order.items
        );

        if (allOrderItems.length === 0) {
          throw createError(
            "There are no eligible order items to bill.",
            400
          );
        }

        const orderItemIds = allOrderItems.map(
          (item) => item.id
        );

        // Find quantities already allocated to previous bills.
        const previousAllocations =
          await tx.billItem.findMany({
            where: {
              orderItemId: {
                in: orderItemIds,
              },
            },
            select: {
              orderItemId: true,
              quantity: true,
            },
          });

        const allocatedQuantities = new Map();

        for (const allocation of previousAllocations) {
          const current =
            allocatedQuantities.get(allocation.orderItemId) ?? 0;

          allocatedQuantities.set(
            allocation.orderItemId,
            current + allocation.quantity
          );
        }

        let subtotalCents = 0n;

        const billItems = [];

        for (const item of allOrderItems) {
          const alreadyAllocated =
            allocatedQuantities.get(item.id) ?? 0;

          const remainingQuantity =
            item.quantity - alreadyAllocated;

          if (remainingQuantity <= 0) {
            continue;
          }

          const unitPriceCents = toCents(item.unitPrice);

          const lineTotalCents =
            unitPriceCents * BigInt(remainingQuantity);

          subtotalCents += lineTotalCents;

          billItems.push({
            orderItemId: item.id,
            itemName: item.itemName,
            quantity: remainingQuantity,
            unitPrice: formatMoney(unitPriceCents),
            lineTotal: formatMoney(lineTotalCents),
          });
        }

        if (billItems.length === 0) {
          throw createError(
            "All order item quantities have already been billed.",
            409
          );
        }

        const total = formatMoney(subtotalCents);

        const bill = await tx.bill.create({
          data: {
            restaurantId,
            sessionId: session.id,
            billNumber: generateBillNumber(),
            status: "OPEN",
            subtotal: total,
            total,
            amountPaid: "0.00",
            balance: total,
            items: {
              create: billItems,
            },
          },
          include: {
            items: true,
            payments: true,
            session: {
              select: {
                id: true,
                table: {
                  select: {
                    tableNumber: true,
                  },
                },
              },
            },
          },
        });

        return bill;
      },
      {
        isolationLevel: "Serializable",
      }
    );
  } catch (error) {
    if (error.code === "P2034") {
      throw createError(
        "Another billing operation changed this session. Refresh and try again.",
        409
      );
    }

    throw error;
  }

}

export const listRestaurantBills = async ({
  restaurantId,
  status,
  page,
  limit,
}) => {
  const where = {
    restaurantId,
    ...(status ? { status } : {}),
  };

  const skip = (page - 1) * limit;

  const [bills, total] = await Promise.all([
    prisma.bill.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        items: true,
        session: {
          select: {
            id: true,
            table: {
              select: {
                tableNumber: true,
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            method: true,
            status: true,
            amount: true,
            reference: true,
            verifiedAt: true,
            createdAt: true,
          },
        },
      },
    }),

    prisma.bill.count({ where }),
  ]);

  return {
    bills,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getRestaurantBillById = async ({
  restaurantId,
  billId,
}) => {
  const bill = await prisma.bill.findFirst({
    where: {
      id: billId,
      restaurantId,
    },
    include: {
      items: {
        include: {
          orderItem: {
            select: {
              id: true,
              orderId: true,
              preparationStatus: true,
              station: true,
            },
          },
        },
      },
      session: {
        select: {
          id: true,
          status: true,
          table: {
            select: {
              id: true,
              tableNumber: true,
            },
          },
        },
      },
      payments: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          method: true,
          status: true,
          amount: true,
          reference: true,
          transactionId: true,
          phoneNumber: true,
          verifiedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!bill) {
    throw createError("Bill not found", 404);
  }

  return bill;
};

export const splitBill = async ({
  restaurantId,
  billId,
  items,
}) => {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const originalBill = await tx.bill.findFirst({
          where: {
            id: billId,
            restaurantId,
          },
          include: {
            items: true,
            payments: true,
            session: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        });

        if (!originalBill) {
          throw createError("Bill not found", 404);
        }

        if (originalBill.status !== "OPEN") {
          throw createError(
            "Only open bills can be split",
            409
          );
        }

        if (
          toCents(originalBill.amountPaid) > 0n ||
          originalBill.payments.some((payment) =>
            ["PENDING", "PROCESSING", "COMPLETED"].includes(
              payment.status
            )
          )
        ) {
          throw createError(
            "Bills with existing or pending payments cannot be split",
            409
          );
        }

        const requestedItems = new Map(
          items.map((item) => [
            item.orderItemId,
            item.quantity,
          ])
        );

        const sourceItems = new Map(
          originalBill.items.map((item) => [
            item.orderItemId,
            item,
          ])
        );

        // Validate every requested allocation before changing anything.
        for (const [orderItemId, quantity] of requestedItems) {
          const existingItem = sourceItems.get(orderItemId);

          if (!existingItem) {
            throw createError(
              "An item does not belong to this bill",
              400
            );
          }

          if (quantity > existingItem.quantity) {
            throw createError(
              `Cannot split more than the billed quantity for ${existingItem.itemName}`,
              400
            );
          }
        }

        const newBillItems = [];
        const remainingItems = [];

        for (const [orderItemId, quantity] of requestedItems) {
          const existingItem = sourceItems.get(orderItemId);

          const unitPriceCents = toCents(existingItem.unitPrice);
          const splitLineTotal = formatMoney(
            unitPriceCents * BigInt(quantity)
          );

          newBillItems.push({
            orderItemId,
            itemName: existingItem.itemName,
            quantity,
            unitPrice: existingItem.unitPrice,
            lineTotal: splitLineTotal,
          });

          const remainingQuantity =
            existingItem.quantity - quantity;

          if (remainingQuantity > 0) {
            remainingItems.push({
              id: existingItem.id,
              quantity: remainingQuantity,
              lineTotal: formatMoney(
                unitPriceCents * BigInt(remainingQuantity)
              ),
            });
          }
        }

        const newBillSubtotalCents = newBillItems.reduce(
          (sum, item) => sum + toCents(item.lineTotal),
          0n
        );

        const newBillTotal = formatMoney(
          newBillSubtotalCents
        );

        // Create the second bill.
        const newBill = await tx.bill.create({
          data: {
            restaurantId,
            sessionId: originalBill.sessionId,
            billNumber: generateBillNumber(),
            status: "OPEN",
            subtotal: newBillTotal,
            total: newBillTotal,
            amountPaid: "0.00",
            balance: newBillTotal,
            items: {
              create: newBillItems,
            },
          },
          include: {
            items: true,
            payments: true,
          },
        });

        // Update the original bill's item quantities.
        for (const item of remainingItems) {
          await tx.billItem.update({
            where: {
              id: item.id,
            },
            data: {
              quantity: item.quantity,
              lineTotal: item.lineTotal,
            },
          });
        }

        // Remove original bill items that were fully transferred.
        const fullyTransferredIds = items
          .filter((item) => {
            const existingItem = sourceItems.get(
              item.orderItemId
            );

            return item.quantity === existingItem.quantity;
          })
          .map((item) => item.orderItemId);

        if (fullyTransferredIds.length > 0) {
          await tx.billItem.deleteMany({
            where: {
              billId: originalBill.id,
              orderItemId: {
                in: fullyTransferredIds,
              },
            },
          });
        }

        // Recalculate the original bill.
        const remainingSubtotalCents =
          remainingItems.reduce(
            (sum, item) => sum + toCents(item.lineTotal),
            0n
          ) +
          originalBill.items
            .filter(
              (item) =>
                !requestedItems.has(item.orderItemId)
            )
            .reduce(
              (sum, item) =>
                sum + toCents(item.lineTotal),
              0n
            );

        const remainingTotal = formatMoney(
          remainingSubtotalCents
        );

        const updatedOriginalBill = await tx.bill.update({
          where: {
            id: originalBill.id,
          },
          data: {
            subtotal: remainingTotal,
            total: remainingTotal,
            balance: remainingTotal,
          },
          include: {
            items: true,
            payments: true,
          },
        });

        return {
          originalBill: updatedOriginalBill,
          newBill,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );
  } catch (error) {
    if (error.code === "P2034") {
      throw createError(
        "The bill changed during splitting. Please retry.",
        409
      );
    }

    throw error;
  }
};

export const recordBillPayment = async ({
  restaurantId,
  billId,
  method,
  amount,
  idempotencyKey,
  reference,
}) => {
  const amountCents = toCents(amount);

  if (amountCents <= 0n) {
    throw createError("Payment amount must be positive", 400);
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Return the original payment if this request was already processed.
        const existingPayment = await tx.payment.findUnique({
          where: {
            restaurantId_idempotencyKey: {
              restaurantId,
              idempotencyKey,
            },
          },
          include: {
            bill: true,
          },
        });

        if (existingPayment) {
          if (
            existingPayment.billId !== billId ||
            existingPayment.method !== method ||
            toCents(existingPayment.amount) !== amountCents
          ) {
            throw createError(
              "This idempotency key was already used for a different payment",
              409
            );
          }

          return {
            payment: existingPayment,
            bill: existingPayment.bill,
            duplicate: true,
          };
        }

        const bill = await tx.bill.findFirst({
          where: {
            id: billId,
            restaurantId,
          },
        });

        if (!bill) {
          throw createError("Bill not found", 404);
        }

        if (["PAID", "VOIDED"].includes(bill.status)) {
          throw createError(
            "This bill cannot accept payments",
            409
          );
        }

        // Include pending payments to prevent over-reserving the bill.
        const reservedPayments = await tx.payment.aggregate({
          where: {
            billId,
            restaurantId,
            status: {
              in: ["PENDING", "PROCESSING"],
            },
          },
          _sum: {
            amount: true,
          },
        });

        const pendingCents = toCents(
          reservedPayments._sum.amount ?? "0"
        );

        const totalCents = toCents(bill.total);
        const paidCents = toCents(bill.amountPaid);

        const availableCents =
          totalCents - paidCents - pendingCents;

        if (amountCents > availableCents) {
          throw createError(
            "Payment exceeds the remaining available bill balance",
            409
          );
        }

        // Cash is recorded as received.
        // Card and bank transfers require separate verification.
        const paymentStatus =
          method === "CASH" ? "COMPLETED" : "PENDING";

        const payment = await tx.payment.create({
          data: {
            restaurantId,
            billId,
            method,
            status: paymentStatus,
            amount: formatMoney(amountCents),
            idempotencyKey,
            reference: reference || null,
            verifiedAt:
              paymentStatus === "COMPLETED"
                ? new Date()
                : null,
          },
        });

        let updatedBill = bill;

        if (paymentStatus === "COMPLETED") {
          const newPaidCents = paidCents + amountCents;
          const newBalanceCents = totalCents - newPaidCents;

          updatedBill = await tx.bill.update({
            where: {
              id: billId,
            },
            data: {
              amountPaid: formatMoney(newPaidCents),
              balance: formatMoney(newBalanceCents),
              status:
                newBalanceCents === 0n
                  ? "PAID"
                  : "PARTIALLY_PAID",
            },
          });
        }

        return {
          payment,
          bill: updatedBill,
          duplicate: false,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );
  } catch (error) {
    if (error.code === "P2034") {
      throw createError(
        "The bill changed during payment processing. Please retry with the same idempotency key.",
        409
      );
    }

    if (error.code === "P2002") {
      const existingPayment = await prisma.payment.findUnique({
        where: {
          restaurantId_idempotencyKey: {
            restaurantId,
            idempotencyKey,
          },
        },
        include: {
          bill: true,
        },
      });

      if (existingPayment) {
        return {
          payment: existingPayment,
          bill: existingPayment.bill,
          duplicate: true,
        };
      }
    }

    throw error;
  }
};
