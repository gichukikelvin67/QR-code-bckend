
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
