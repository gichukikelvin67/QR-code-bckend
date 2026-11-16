
import prisma from "../../config/database.js";

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
  userRole
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: {
        id: orderId,
        restaurantId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!order) {
      throw createError("Order not found.", 404);
    }

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

    // Update only if the status is still the one we read.
    // This prevents two staff members from advancing the same
    // order simultaneously.
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
  });
}
