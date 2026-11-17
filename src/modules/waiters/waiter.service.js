
import prisma from "../../config/database.js";
import { getSocketInstance } from "../../sockets/socket-instance.js";
import { synchronizeOrderStatus } from "../orders/order-status.service.js";

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Retrieve all ready items belonging to this restaurant.
export async function getWaiterQueue(restaurantId) {
  return prisma.orderItem.findMany({
    where: {
      preparationStatus: "READY",
      order: {
        is: {
          restaurantId,
          status: {
            not: "CANCELLED",
          },
        },
      },
    },
    select: {
      id: true,
      itemName: true,
      quantity: true,
      notes: true,
      station: true,
      preparationStatus: true,
      createdAt: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          source: true,
          status: true,
          createdAt: true,
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
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

// A waiter can serve an item only after it is READY.
export async function serveOrderItem({
  restaurantId,
  itemId,
  userId,
}) {
  const item = await prisma.orderItem.findFirst({
    where: {
      id: itemId,
      preparationStatus: "READY",
      order: {
        is: {
          restaurantId,
          status: {
            not: "CANCELLED",
          },
        },
      },
    },
    select: {
      id: true,
      itemName: true,
      quantity: true,
      station: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
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
      },
    },
  });

  if (!item) {
    throw createError(
      "Ready item not found. It may already have been served.",
      404
    );
  }

  // Conditional update prevents two waiters from serving
  // the same item simultaneously.

const updatedItem = await prisma.$transaction(async (tx) => {
  const result = await tx.orderItem.updateMany({
    where: {
      id: itemId,
      preparationStatus: "READY",
      order: {
        is: {
          restaurantId,
          status: {
            not: "CANCELLED",
          },
        },
      },
    },
    data: {
      preparationStatus: "SERVED",
    },
  });

  if (result.count !== 1) {
    throw createError(
      "This item has already been updated. Refresh the queue.",
      409
    );
  }

  // Synchronize the overall order status.
  await synchronizeOrderStatus(tx, item.order.id);

  return tx.orderItem.findFirst({
    where: {
      id: itemId,
      order: {
        is: {
          restaurantId,
        },
      },
    },
    select: {
      id: true,
      itemName: true,
      quantity: true,
      station: true,
      preparationStatus: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
        },
      },
    },
  });
});

  const io = getSocketInstance();

  if (io && updatedItem) {
    const eventPayload = {
      itemId: updatedItem.id,
      itemName: updatedItem.itemName,
      quantity: updatedItem.quantity,
      station: updatedItem.station,
      preparationStatus: updatedItem.preparationStatus,
      orderId: updatedItem.order.id,
      orderNumber: updatedItem.order.orderNumber,
      tableNumber: item.order.session.table.tableNumber,
      servedBy: userId,
    };

    // Notify the relevant preparation station and service team.
    io.to(`restaurant:${restaurantId}:${item.station.toLowerCase()}`)
      .emit("preparation:status-updated", eventPayload);

    io.to(`restaurant:${restaurantId}:service`)
      .emit("service:item-served", eventPayload);
  }

  return updatedItem;
}
