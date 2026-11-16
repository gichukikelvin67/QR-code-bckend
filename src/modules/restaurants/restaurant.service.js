
import prisma from "../../config/database.js";

export async function getCurrentRestaurant(restaurantId) {
  const restaurant = await prisma.restaurant.findUnique({
    where: {
      id: restaurantId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!restaurant || !restaurant.isActive) {
    const error = new Error("Restaurant not found or inactive.");
    error.statusCode = 404;
    throw error;
  }

  return restaurant;
}

export async function updateRestaurant(restaurantId, data) {
  const existingRestaurant = await prisma.restaurant.findUnique({
    where: {
      id: restaurantId,
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!existingRestaurant || !existingRestaurant.isActive) {
    const error = new Error("Restaurant not found or inactive.");
    error.statusCode = 404;
    throw error;
  }

  return prisma.restaurant.update({
    where: {
      id: restaurantId,
    },
    data,
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
