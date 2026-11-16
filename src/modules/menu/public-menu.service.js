
import prisma from "../../config/database.js";

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function getPublicRestaurantMenu(
  restaurantSlug,
  tableToken
) {
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      slug: restaurantSlug,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  if (!restaurant) {
    throw createError("Restaurant not found.", 404);
  }

  const table = await prisma.restaurantTable.findFirst({
    where: {
      qrToken: tableToken,
      restaurantId: restaurant.id,
    },
    select: {
      id: true,
      tableNumber: true,
      capacity: true,
      status: true,
    },
  });

  if (!table) {
    throw createError(
      "Invalid table QR code.",
      404
    );
  }

  if (table.status === "OUT_OF_SERVICE") {
    throw createError(
      "This table is currently unavailable.",
      409
    );
  }

  const categories = await prisma.menuCategory.findMany({
    where: {
      restaurantId: restaurant.id,
      isActive: true,
      items: {
        some: {
          restaurantId: restaurant.id,
          isAvailable: true,
        },
      },
    },
    orderBy: [
      { sortOrder: "asc" },
      { name: "asc" },
    ],
    select: {
      id: true,
      name: true,
      description: true,
      sortOrder: true,
      items: {
        where: {
          restaurantId: restaurant.id,
          isAvailable: true,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          imageUrl: true,
          isAvailable: true,
        },
      },
    },
  });

  return {
    restaurant,
    table: {
      id: table.id,
      tableNumber: table.tableNumber,
      capacity: table.capacity,
    },
    categories,
  };
}
