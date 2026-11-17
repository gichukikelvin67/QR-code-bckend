
import prisma from "../../config/database.js";
import { getSocketInstance } from "../../sockets/socket-instance.js";
import { synchronizeOrderStatus } from "../orders/order-status.service.js";

const preparationTransitions = {
  PENDING: "PREPARING",
  PREPARING: "READY",
};

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function getPreparationQueue(restaurantId, station) {
  return prisma.orderItem.findMany({
    where: {
      station,
      preparationStatus: {
        in: ["PENDING", "PREPARING", "READY"],
      },
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


export async function updatePreparationStatus({
  restaurantId,
  itemId,
  station,
  newStatus,
}) {
  const currentItem = await prisma.orderItem.findFirst({
    where: {
      id: itemId,
      station,
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
      preparationStatus: true,
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

  if (!currentItem) {
    throw createError("Preparation item not found.", 404);
  }

  const expectedNextStatus =
    preparationTransitions[currentItem.preparationStatus];

  if (expectedNextStatus !== newStatus) {
    throw createError(
      `Cannot move item from ${currentItem.preparationStatus} to ${newStatus}.`,
      409
    );
  }

  
const updatedItem = await prisma.$transaction(async (tx) => {
  const result = await tx.orderItem.updateMany({
    where: {
      id: itemId,
      station,
      preparationStatus: currentItem.preparationStatus,
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
      preparationStatus: newStatus,
    },
  });

  if (result.count !== 1) {
    throw createError(
      "The item was updated by another staff member. Refresh the queue and try again.",
      409
    );
  }

  // Update the overall order status in the same transaction.
  await synchronizeOrderStatus(tx, currentItem.order.id);

  return tx.orderItem.findFirst({
    where: {
      id: itemId,
      station,
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
    io.to(`restaurant:${restaurantId}:${station.toLowerCase()}`).emit(
      "preparation:status-updated",
      {
        itemId: updatedItem.id,
        itemName: updatedItem.itemName,
        quantity: updatedItem.quantity,
        station,
        preparationStatus: updatedItem.preparationStatus,
        orderId: updatedItem.order.id,
         orderNumber: updatedItem.order.orderNumber,
        orderStatus: updatedItem.order.status,
        tableNumber: currentItem.order.session.table.tableNumber,
      }
    );
    if (newStatus === "READY") {
  io.to(`restaurant:${restaurantId}:service`).emit(
    "service:item-ready",
    {
      itemId: updatedItem.id,
      itemName: updatedItem.itemName,
      quantity: updatedItem.quantity,
      station: updatedItem.station,
      preparationStatus: updatedItem.preparationStatus,
      orderId: updatedItem.order.id,
      orderNumber: updatedItem.order.orderNumber,
      tableNumber:
        currentItem.order.session.table.tableNumber,
    }
  );
}
  }

  return updatedItem;
}
