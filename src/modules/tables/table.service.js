
import QRCode from "qrcode";
import prisma from "../../config/database.js";
import { env } from "../../config/env.js";

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function createTable(restaurantId, data) {
  try {
    const table = await prisma.restaurantTable.create({
      data: {
        restaurantId,
        tableNumber: data.tableNumber,
        capacity: data.capacity,
      },
    });

    return table;
  } catch (error) {
    if (error.code === "P2002") {
      throw createError(
        "A table with this number already exists in your restaurant.",
        409
      );
    }

    throw error;
  }
}

export async function getRestaurantTables(restaurantId) {
  return prisma.restaurantTable.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    include: {
      sessions: {
        where: { status: "OPEN" },
        select: {
          id: true,
          status: true,
          startedAt: true,
        },
      },
    },
  });
}

export async function getTableById(restaurantId, tableId) {
  const table = await prisma.restaurantTable.findFirst({
    where: {
      id: tableId,
      restaurantId,
    },
    include: {
      sessions: {
        where: { status: "OPEN" },
        select: {
          id: true,
          status: true,
          startedAt: true,
        },
      },
    },
  });

  if (!table) {
    throw createError("Table not found.", 404);
  }

  return table;
}

export async function updateTable(restaurantId, tableId, data) {
  await getTableById(restaurantId, tableId);

  try {
    return await prisma.restaurantTable.update({
      where: { id: tableId },
      data,
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw createError(
        "A table with this number already exists in your restaurant.",
        409
      );
    }

    throw error;
  }
}

export async function generateTableQRCode(restaurantId, tableId) {
  const [table, restaurant] = await Promise.all([
    getTableById(restaurantId, tableId),
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true },
    }),
  ]);

  if (!restaurant) {
    throw createError("Restaurant not found.", 404);
  }

  const orderUrl = new URL(
    `/order/${restaurant.slug}`,
    env.FRONTEND_URL
  );

  orderUrl.searchParams.set("table", table.qrToken);

  const qrCode = await QRCode.toDataURL(orderUrl.toString(), {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 400,
  });

  return {
    tableId: table.id,
    tableNumber: table.tableNumber,
    qrCode,
    orderUrl: orderUrl.toString(),
  };
}
