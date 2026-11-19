
import prisma from "../../config/database.js";
import { createAuditLog } from "../audits/audit.service.js";

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getChangedFields(previous, updated) {
  const changed = {};

  for (const key of Object.keys(updated)) {
    if (String(previous[key] ?? "") !== String(updated[key] ?? "")) {
      changed[key] = {
        previous: previous[key],
        updated: updated[key],
      };
    }
  }

  return changed;
}

function handleDuplicateError(error, message) {
  if (error.code === "P2002") {
    throw createError(message, 409);
  }

  throw error;
}

// CATEGORY OPERATIONS

export async function createCategory(restaurantId, userId, data) {
  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.menuCategory.create({
        data: {
          restaurantId,
          ...data,
        },
      });

      await createAuditLog({
        tx,
        restaurantId,
        userId,
        action: "MENU_CATEGORY_CREATED",
        resource: "MENU_CATEGORY",
        resourceId: category.id,
        description: `Created menu category ${category.name}.`,
        metadata: {
          categoryName: category.name,
          sortOrder: category.sortOrder,
        },
      });

      return category;
    });
  } catch (error) {
    handleDuplicateError(
      error,
      "A category with this name already exists."
    );
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
  userId,
  categoryId,
  data
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existingCategory = await tx.menuCategory.findFirst({
        where: {
          id: categoryId,
          restaurantId,
        },
      });

      if (!existingCategory) {
        throw createError("Menu category not found.", 404);
      }

      const updatedCategory = await tx.menuCategory.update({
        where: { id: categoryId },
        data,
      });

      const changes = getChangedFields(existingCategory, data);

      if (Object.keys(changes).length > 0) {
        await createAuditLog({
          tx,
          restaurantId,
          userId,
          action: "MENU_CATEGORY_UPDATED",
          resource: "MENU_CATEGORY",
          resourceId: categoryId,
          description: `Updated menu category ${updatedCategory.name}.`,
          metadata: {
            changes,
          },
        });
      }

      return updatedCategory;
    });
  } catch (error) {
    handleDuplicateError(
      error,
      "A category with this name already exists."
    );
  }
}

// MENU ITEM OPERATIONS

export async function createMenuItem(restaurantId, userId, data) {
  return prisma.$transaction(async (tx) => {
    const category = await tx.menuCategory.findFirst({
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

    const item = await tx.menuItem.create({
      data: {
        ...data,
        restaurantId,
        price: String(data.price),
      },
      include: {
        category: true,
      },
    });

    await createAuditLog({
      tx,
      restaurantId,
      userId,
      action: "MENU_ITEM_CREATED",
      resource: "MENU_ITEM",
      resourceId: item.id,
      description: `Created menu item ${item.name}.`,
      metadata: {
        itemName: item.name,
        categoryId: item.categoryId,
        price: String(item.price),
        station: item.station,
        isAvailable: item.isAvailable,
      },
    });

    return item;
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
  userId,
  itemId,
  data
) {
  return prisma.$transaction(async (tx) => {
    const existingItem = await tx.menuItem.findFirst({
      where: {
        id: itemId,
        restaurantId,
      },
    });

    if (!existingItem) {
      throw createError("Menu item not found.", 404);
    }

    if (data.categoryId) {
      const category = await tx.menuCategory.findFirst({
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

    const updatedItem = await tx.menuItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        category: true,
      },
    });

    const changes = getChangedFields(existingItem, updateData);

    if (Object.keys(changes).length > 0) {
      const action = Object.hasOwn(changes, "price")
        ? "MENU_ITEM_PRICE_UPDATED"
        : Object.hasOwn(changes, "isAvailable")
          ? "MENU_ITEM_AVAILABILITY_UPDATED"
          : "MENU_ITEM_UPDATED";

      await createAuditLog({
        tx,
        restaurantId,
        userId,
        action,
        resource: "MENU_ITEM",
        resourceId: itemId,
        description: `Updated menu item ${updatedItem.name}.`,
        metadata: {
          itemName: updatedItem.name,
          changes,
        },
      });
    }

    return updatedItem;
  });
}
