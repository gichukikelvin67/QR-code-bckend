
import { randomBytes } from "node:crypto";
import prisma from "../../config/database.js";
import { getSocketInstance } from "../../sockets/socket-instance.js";

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Convert a database decimal price to integer cents.
// This avoids floating-point arithmetic when calculating totals.
function toCents(value) {
  const price = String(value);
  const [whole, fraction = ""] = price.split(".");
  const cents = `${fraction}00`.slice(0, 2);

  return BigInt(whole) * 100n + BigInt(cents);
}

function formatMoney(cents) {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

function generateOrderNumber() {
  const date = new Date();
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");

  return `ORD-${datePart}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function createPublicOrder(
  restaurantSlug,
  tableToken,
  data
) {
  const result=await prisma.$transaction(
    async (tx) => {
      const restaurant = await tx.restaurant.findFirst({
        where: {
          slug: restaurantSlug,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!restaurant) {
        throw createError("Restaurant not found.", 404);
      }

      const table = await tx.restaurantTable.findFirst({
        where: {
          restaurantId: restaurant.id,
          qrToken: tableToken,
          status: "OCCUPIED",
        },
        select: {
          id: true,
          tableNumber: true,
        },
      });

      if (!table) {
        throw createError(
          "This QR code is invalid or the table is not currently occupied.",
          409
        );
      }

      const session = await tx.diningSession.findFirst({
        where: {
          tableId: table.id,
          status: "OPEN",
        },
        select: {
          id: true,
        },
      });

      if (!session) {
        throw createError(
          "There is no open dining session for this table.",
          409
        );
      }

      const requestedIds = data.items.map(
        (item) => item.menuItemId
      );

      const menuItems = await tx.menuItem.findMany({
        where: {
          id: { in: requestedIds },
          restaurantId: restaurant.id,
          isAvailable: true,
          category: {
            isActive: true,
          },
        },
        select: {
          id: true,
          name: true,
          price: true,
          station:true,
        },
      });

      if (menuItems.length !== requestedIds.length) {
        throw createError(
          "One or more menu items are unavailable or invalid.",
          400
        );
      }

      const menuItemMap = new Map(
        menuItems.map((item) => [item.id, item])
      );

      let subtotalCents = 0n;

      const orderItems = data.items.map((requestedItem) => {
        const menuItem = menuItemMap.get(
          requestedItem.menuItemId
        );

        const unitPriceCents = toCents(menuItem.price);
        const lineTotalCents =
          unitPriceCents * BigInt(requestedItem.quantity);

        subtotalCents += lineTotalCents;

        return {
          menuItemId: menuItem.id,
          itemName: menuItem.name,
          unitPrice: formatMoney(unitPriceCents),
          quantity: requestedItem.quantity,
          notes: requestedItem.notes ?? null,
          lineTotal: formatMoney(lineTotalCents),

          station:menuItem.station,
          preparationStatus:"PENDING",
        };
      });

      const orderNumber = generateOrderNumber();

      const order = await tx.order.create({
        data: {
          restaurantId: restaurant.id,
          sessionId: session.id,
          orderNumber,
          source: "QR",
          status: "PENDING",
          notes: data.notes ?? null,
          subtotal: formatMoney(subtotalCents),
          total: formatMoney(subtotalCents),
          items: {
            create: orderItems,
          },
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
        },
      });

      return {
        order,
        restaurant,
      };
    },
    {
      isolationLevel: "Serializable",
    }
 
  ).catch((error) => {
    if (error.code === "P2034") {
      throw createError(
        "The table or session changed while processing your order. Please retry.",
        409
      );
    }

    throw error;
  });

  // Get Socket.IO after the database transaction commits.
  const io = getSocketInstance();

  if (io) {
    const kitchenItems = result.order.items.filter(
      (item) => item.station === "KITCHEN"
    );

    const barItems = result.order.items.filter(
      (item) => item.station === "BAR"
    );

    const eventPayload = {
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
      tableNumber: result.order.session.table.tableNumber,
      orderStatus: result.order.status,
    };

    if (kitchenItems.length > 0) {
      io.to(`restaurant:${result.restaurant.id}:kitchen`).emit(
        "preparation:new-order",
        {
          ...eventPayload,
          station: "KITCHEN",
          items: kitchenItems,
        }
      );
    }

    if (barItems.length > 0) {
      io.to(`restaurant:${result.restaurant.id}:bar`).emit(
        "preparation:new-order",
        {
          ...eventPayload,
          station: "BAR",
          items: barItems,
        }
      );
    }
  }

  return result;
}

