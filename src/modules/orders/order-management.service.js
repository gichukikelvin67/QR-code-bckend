
import prisma from "../../config/database.js";
import { Prisma } from "@prisma/client";

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const statusTransitions = {
  PENDING: {
    next: "ACCEPTED",
    roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"],
  },
  ACCEPTED: {
    next: "PREPARING",
    roles: ["OWNER", "ADMIN", "MANAGER", "KITCHEN", "BAR"],
  },
  PREPARING: {
    next: "READY",
    roles: ["OWNER", "ADMIN", "MANAGER", "KITCHEN", "BAR"],
  },
  READY: {
    next: "SERVED",
    roles: ["OWNER", "ADMIN", "MANAGER", "WAITER"],
  },
};
const cancellationRules = {
  PENDING: ["OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"],
  ACCEPTED: ["OWNER", "ADMIN", "MANAGER"],
  PREPARING: ["OWNER", "ADMIN", "MANAGER"],
  READY: ["OWNER", "ADMIN", "MANAGER"],
};

export async function getRestaurantOrders(restaurantId, status) {
  return prisma.order.findMany({
    where: {
      restaurantId,
      ...(status ? { status } : {}),
    },
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
              id: true,
              tableNumber: true,
            },
          },
        },
      },
    },
  });
}

export async function getRestaurantOrderById(
  restaurantId,
  orderId
) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      restaurantId,
    },
    include: {
      items: true,
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
    },
  });

  if (!order) {
    throw createError("Order not found.", 404);
  }

  return order;
}



export async function updateRestaurantOrderStatus(
  restaurantId,
  orderId,
  newStatus,
  userRole,
  userId
) {
  return prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          restaurantId,
        },
        include: {
          items: {
            include: {
              menuItem: {
                include: {
                  recipeIngredients: {
                    include: {
                      inventoryItem: true,
                    },
                  },
                },
              },
              stockDeductions: {
                include: {
                  inventoryItem: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw createError("Order not found.", 404);
      }

      // Validate the requested transition.
      if (newStatus === "CANCELLED") {
        const allowedRoles = cancellationRules[order.status];

        if (!allowedRoles) {
          throw createError(
            `Orders in ${order.status} status cannot be cancelled.`,
            409
          );
        }

        if (!allowedRoles.includes(userRole)) {
          throw createError(
            "You do not have permission to cancel this order.",
            403
          );
        }

        // Restore stock only if the order was accepted
// but preparation has not started.
const deductions =
  order.status === "ACCEPTED"
    ? order.items.flatMap((item) => item.stockDeductions)
    : [];

        deductions.sort((a, b) =>
          a.inventoryItemId.localeCompare(b.inventoryItemId)
        );

        for (const deduction of deductions) {
          // Lock the inventory row before restoring stock.
          const lockedItems = await tx.$queryRaw`
            SELECT "currentStock"
            FROM "InventoryItem"
            WHERE "id" = ${deduction.inventoryItemId}
              AND "restaurantId" = ${restaurantId}
            FOR UPDATE
          `;

          if (lockedItems.length !== 1) {
            throw createError(
              "Inventory item could not be found during stock restoration.",
              409
            );
          }

          // Restore each deduction exactly once.
          const restoration = await tx.stockDeduction.updateMany({
            where: {
              id: deduction.id,
              restoredAt: null,
            },
            data: {
              restoredAt: new Date(),
            },
          });

          if (restoration.count !== 1) {
            continue;
          }

          const stockBefore = new Prisma.Decimal(
            lockedItems[0].currentStock.toString()
          );

          const quantity = new Prisma.Decimal(
            deduction.quantity.toString()
          );

          const stockAfter = stockBefore.plus(quantity);

          await tx.inventoryItem.update({
            where: {
              id: deduction.inventoryItemId,
            },
            data: {
              currentStock: {
                increment: quantity,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              restaurantId,
              inventoryItemId: deduction.inventoryItemId,
              type: "RETURN",
              quantity,
              stockBefore,
              stockAfter,
              referenceId: order.id,
              notes: `Stock restoration for cancelled order ${order.orderNumber}`,
            },
          });
        }
      } else {
        const transition = statusTransitions[order.status];

        if (!transition || transition.next !== newStatus) {
          throw createError(
            `Order cannot move from ${order.status} to ${newStatus}.`,
            409
          );
        }

        if (!transition.roles.includes(userRole)) {
          throw createError(
            "You do not have permission to perform this order action.",
            403
          );
        }

        // Deduct recipe ingredients when the order is accepted.
        if (newStatus === "ACCEPTED") {
          const deductions = [];

          for (const orderItem of order.items) {
            if (!orderItem.menuItem) continue;

            for (const ingredient of orderItem.menuItem.recipeIngredients) {
              const inventoryItem = ingredient.inventoryItem;

              if (
                !inventoryItem ||
                inventoryItem.restaurantId !== restaurantId ||
                !inventoryItem.isActive
              ) {
                throw createError(
                  `An ingredient for ${orderItem.itemName} is unavailable.`,
                  409
                );
              }

              const requiredQuantity = new Prisma.Decimal(
                ingredient.quantity.toString()
              ).mul(orderItem.quantity);

              deductions.push({
                orderItem,
                inventoryItem,
                requiredQuantity,
              });
            }
          }

          deductions.sort((a, b) =>
            a.inventoryItem.id.localeCompare(b.inventoryItem.id)
          );

          for (const deduction of deductions) {
            const {
              orderItem,
              inventoryItem,
              requiredQuantity,
            } = deduction;

            const existingDeduction =
              await tx.stockDeduction.findUnique({
                where: {
                  orderItemId_inventoryItemId: {
                    orderItemId: orderItem.id,
                    inventoryItemId: inventoryItem.id,
                  },
                },
              });

            if (existingDeduction) {
              throw createError(
                `Stock has already been deducted for ${orderItem.itemName}.`,
                409
              );
            }

            const lockedItems = await tx.$queryRaw`
              SELECT "currentStock"
              FROM "InventoryItem"
              WHERE "id" = ${inventoryItem.id}
                AND "restaurantId" = ${restaurantId}
              FOR UPDATE
            `;

            if (lockedItems.length !== 1) {
              throw createError(
                "Inventory item could not be locked.",
                409
              );
            }

            const stockBefore = new Prisma.Decimal(
              lockedItems[0].currentStock.toString()
            );

            if (stockBefore.lessThan(requiredQuantity)) {
              throw createError(
                `Insufficient stock for ${inventoryItem.name}. Required: ${requiredQuantity.toFixed(3)} ${inventoryItem.unit}, available: ${stockBefore.toFixed(3)} ${inventoryItem.unit}.`,
                409
              );
            }

            const stockAfter = stockBefore.minus(requiredQuantity);

            await tx.inventoryItem.update({
              where: {
                id: inventoryItem.id,
              },
              data: {
                currentStock: {
                  decrement: requiredQuantity,
                },
              },
            });

            await tx.stockDeduction.create({
              data: {
                orderItemId: orderItem.id,
                inventoryItemId: inventoryItem.id,
                quantity: requiredQuantity,
              },
            });

            await tx.stockMovement.create({
              data: {
                restaurantId,
                inventoryItemId: inventoryItem.id,
                type: "RECIPE_DEDUCTION",
                quantity: requiredQuantity,
                stockBefore,
                stockAfter,
                referenceId: order.id,
                notes: `Ingredient deduction for order ${order.orderNumber}`,
              },
            });
          }
        }
      }

      // Update the order only after stock operations succeed.
      const result = await tx.order.updateMany({
        where: {
          id: orderId,
          restaurantId,
          status: order.status,
        },
        data: {
          status: newStatus,
        },
      });

      if (result.count !== 1) {
        throw createError(
          "The order was updated by another staff member. Refresh and try again.",
          409
        );
      }

      // Record the staff member responsible for this transition.
await tx.orderStatusHistory.create({
  data: {
    restaurantId,
    orderId,
    performedBy: userId,
    fromStatus: order.status,
    toStatus: newStatus,
  },
});

      return tx.order.findFirst({
        where: {
          id: orderId,
          restaurantId,
        },
        include: {
          items: true,
          session: {
            select: {
              table: {
                select: {
                  tableNumber: true,
                },
              },
            },
          },
        },
      });
    },
    {
      isolationLevel: "Serializable",
    }
  ).catch((error) => {
    if (error.code === "P2034") {
      throw createError(
        "The order or inventory changed during processing. Refresh and try again.",
        409
      );
    }

    throw error;
  });
}
