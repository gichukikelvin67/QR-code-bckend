
import prisma from "../../config/database.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const ensureMenuItem = async (restaurantId, menuItemId, tx = prisma) => {
  const menuItem = await tx.menuItem.findFirst({
    where: {
      id: menuItemId,
      restaurantId,
    },
  });

  if (!menuItem) {
    throw createError("Menu item not found.", 404);
  }

  return menuItem;
};

export const addRecipeIngredient = async (
  restaurantId,
  menuItemId,
  data
) => {
  return prisma.$transaction(async (tx) => {
    await ensureMenuItem(restaurantId, menuItemId, tx);

    const inventoryItem = await tx.inventoryItem.findFirst({
      where: {
        id: data.inventoryItemId,
        restaurantId,
        isActive: true,
      },
    });

    if (!inventoryItem) {
      throw createError(
        "Inventory item not found or inactive.",
        404
      );
    }

    const existing = await tx.recipeIngredient.findUnique({
      where: {
        menuItemId_inventoryItemId: {
          menuItemId,
          inventoryItemId: data.inventoryItemId,
        },
      },
    });

    if (existing) {
      throw createError(
        "This ingredient already exists in the recipe. Update its quantity instead.",
        409
      );
    }

    return tx.recipeIngredient.create({
      data: {
        menuItemId,
        inventoryItemId: data.inventoryItemId,
        quantity: data.quantity,
      },
      include: {
        inventoryItem: true,
        menuItem: true,
      },
    });
  });
};

export const getMenuItemRecipe = async (
  restaurantId,
  menuItemId
) => {
  await ensureMenuItem(restaurantId, menuItemId);

  const ingredients = await prisma.recipeIngredient.findMany({
    where: {
      menuItemId,
      menuItem: {
        restaurantId,
      },
    },
    include: {
      inventoryItem: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return ingredients;
};

export const updateRecipeIngredient = async (
  restaurantId,
  ingredientId,
  data
) => {
  const ingredient = await prisma.recipeIngredient.findFirst({
    where: {
      id: ingredientId,
      menuItem: {
        restaurantId,
      },
      inventoryItem: {
        restaurantId,
      },
    },
  });

  if (!ingredient) {
    throw createError("Recipe ingredient not found.", 404);
  }

  return prisma.recipeIngredient.update({
    where: {
      id: ingredientId,
    },
    data: {
      quantity: data.quantity,
    },
    include: {
      inventoryItem: true,
      menuItem: true,
    },
  });
};

export const removeRecipeIngredient = async (
  restaurantId,
  ingredientId
) => {
  const ingredient = await prisma.recipeIngredient.findFirst({
    where: {
      id: ingredientId,
      menuItem: {
        restaurantId,
      },
      inventoryItem: {
        restaurantId,
      },
    },
  });

  if (!ingredient) {
    throw createError("Recipe ingredient not found.", 404);
  }

  return prisma.recipeIngredient.delete({
    where: {
      id: ingredientId,
    },
  });
};
