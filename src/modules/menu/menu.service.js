
import prisma from "../../config/database.js";

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// CATEGORY OPERATIONS

export async function createCategory(restaurantId, data) {
  try {
    return await prisma.menuCategory.create({
      data: {
        restaurantId,
        ...data,
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw createError(
        "A category with this name already exists.",
        409
      );
    }

    throw error;
  }
}

export async function getCategories(restaurantId) {
  return prisma.menuCategory.findMany({
    where: { restaurantId },
    orderBy: [
      { sortOrder: "asc" },
      { name: "asc" },
    ],
    include: {
      _count: {
        select: { items: true },
      },
    },
  });
}

export async function updateCategory(
  restaurantId,
  categoryId,
  data
) {
  const category = await prisma.menuCategory.findFirst({
    where: {
      id: categoryId,
      restaurantId,
    },
  });

  if (!category) {
    throw createError("Menu category not found.", 404);
  }

  try {
    return await prisma.menuCategory.update({
      where: { id: categoryId },
      data,
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw createError(
        "A category with this name already exists.",
        409
      );
    }

    throw error;
  }
}

// MENU ITEM OPERATIONS

export async function createMenuItem(restaurantId, data) {
  const category = await prisma.menuCategory.findFirst({
    where: {
      id: data.categoryId,
      restaurantId,
      isActive: true,
    },
  });

  if (!category) {
    throw createError(
      "The selected category does not exist or is inactive.",
      404
    );
  }

  return prisma.menuItem.create({
    data: {
      ...data,
      restaurantId,
      price: String(data.price),
    },
    include: {
      category: true,
    },
  });
}

export async function getMenuItems(restaurantId, filters = {}) {
  const where = {
    restaurantId,
  };

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.availableOnly === "true") {
    where.isAvailable = true;
  }

  return prisma.menuItem.findMany({
    where,
    orderBy: {
      name: "asc",
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function getMenuItemById(restaurantId, itemId) {
  const item = await prisma.menuItem.findFirst({
    where: {
      id: itemId,
      restaurantId,
    },
    include: {
      category: true,
    },
  });

  if (!item) {
    throw createError("Menu item not found.", 404);
  }

  return item;
}

export async function updateMenuItem(
  restaurantId,
  itemId,
  data
) {
  await getMenuItemById(restaurantId, itemId);

  if (data.categoryId) {
    const category = await prisma.menuCategory.findFirst({
      where: {
        id: data.categoryId,
        restaurantId,
        isActive: true,
      },
    });

    if (!category) {
      throw createError(
        "The selected category does not exist or is inactive.",
        404
      );
    }
  }

  const updateData = { ...data };

  if (updateData.price !== undefined) {
    updateData.price = String(updateData.price);
  }

  return prisma.menuItem.update({
    where: { id: itemId },
    data: updateData,
    include: {
      category: true,
    },
  });
}
