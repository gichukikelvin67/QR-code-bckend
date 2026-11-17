
import prisma from "../../config/database.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toDecimal = (value) => Number(value);

const pagination = (page, limit) => ({
  skip: (page - 1) * limit,
  take: limit,
});

export const createInventoryCategory = async (restaurantId, data) => {
  const existing = await prisma.inventoryCategory.findFirst({
    where: {
      restaurantId,
      name: { equals: data.name, mode: "insensitive" },
    },
  });

  if (existing) {
    throw createError("An inventory category with this name already exists.", 409);
  }

  return prisma.inventoryCategory.create({
    data: {
      restaurantId,
      name: data.name,
      description: data.description ?? null,
    },
  });
};

export const listInventoryCategories = async (restaurantId) => {
  return prisma.inventoryCategory.findMany({
    where: { restaurantId },
    include: {
      _count: { select: { items: true } },
    },
    orderBy: { name: "asc" },
  });
};

export const updateInventoryCategory = async (
  restaurantId,
  categoryId,
  data
) => {
  const category = await prisma.inventoryCategory.findFirst({
    where: { id: categoryId, restaurantId },
  });

  if (!category) {
    throw createError("Inventory category not found.", 404);
  }

  if (data.name && data.name.toLowerCase() !== category.name.toLowerCase()) {
    const duplicate = await prisma.inventoryCategory.findFirst({
      where: {
        restaurantId,
        name: { equals: data.name, mode: "insensitive" },
        NOT: { id: categoryId },
      },
    });

    if (duplicate) {
      throw createError("An inventory category with this name already exists.", 409);
    }
  }

  return prisma.inventoryCategory.update({
    where: { id: categoryId },
    data,
  });
};


export const createInventoryItem = async (restaurantId, data) => {
  if (data.categoryId) {
    const category = await prisma.inventoryCategory.findFirst({
      where: {
        id: data.categoryId,
        restaurantId,
        isActive: true,
      },
    });

    if (!category) {
      throw createError("Inventory category not found or inactive.", 404);
    }
  }

  if (data.sku) {
    const duplicate = await prisma.inventoryItem.findFirst({
      where: { restaurantId, sku: data.sku },
    });

    if (duplicate) {
      throw createError("An inventory item with this SKU already exists.", 409);
    }
  }

  const initialStock = Number(data.currentStock ?? 0);

  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.create({
      data: {
        restaurantId,
        categoryId: data.categoryId ?? null,
        name: data.name,
        sku: data.sku ?? null,
        description: data.description ?? null,
        unit: data.unit,
        currentStock: initialStock,
        reorderLevel: data.reorderLevel ?? 0,
        costPerUnit: data.costPerUnit ?? 0,
      },
    });

    if (initialStock > 0) {
      await tx.stockMovement.create({
        data: {
          restaurantId,
          inventoryItemId: item.id,
          type: "ADJUSTMENT_IN",
          quantity: initialStock,
          stockBefore: 0,
          stockAfter: initialStock,
          referenceId: "INITIAL_STOCK",
          notes: "Opening inventory balance",
        },
      });
    }

    return item;
  });
};




export const listInventoryItems = async (restaurantId, filters) => {
  const {
    search,
    categoryId,
    lowStock,
    isActive,
    page,
    limit,
  } = filters;

  const where = {
    restaurantId,
    ...(categoryId ? { categoryId } : {}),
    ...(isActive !== undefined
      ? { isActive: isActive === "true" }
      : {}),
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              sku: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  // Fetch matching records before applying low-stock filtering.
  if (lowStock === "true") {
    const allItems = await prisma.inventoryItem.findMany({
      where,
      include: { category: true },
      orderBy: { name: "asc" },
    });

    const filteredItems = allItems.filter(
      (item) =>
        Number(item.currentStock) <= Number(item.reorderLevel)
    );

    const total = filteredItems.length;
    const start = (page - 1) * limit;

    return {
      items: filteredItems.slice(start, start + limit),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  const [items, total] = await prisma.$transaction([
    prisma.inventoryItem.findMany({
      where,
      include: { category: true },
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),

    prisma.inventoryItem.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};


export const getInventoryItem = async (restaurantId, itemId) => {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, restaurantId },
    include: {
      category: true,
      recipeIngredients: {
        include: { menuItem: true },
      },
      movements: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!item) {
    throw createError("Inventory item not found.", 404);
  }

  return item;
};

export const updateInventoryItem = async (
  restaurantId,
  itemId,
  data
) => {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, restaurantId },
  });

  if (!item) {
    throw createError("Inventory item not found.", 404);
  }

  if (data.categoryId) {
    const category = await prisma.inventoryCategory.findFirst({
      where: {
        id: data.categoryId,
        restaurantId,
        isActive: true,
      },
    });

    if (!category) {
      throw createError("Inventory category not found or inactive.", 404);
    }
  }

  if (data.sku && data.sku !== item.sku) {
    const duplicate = await prisma.inventoryItem.findFirst({
      where: { restaurantId, sku: data.sku },
    });

    if (duplicate) {
      throw createError("An inventory item with this SKU already exists.", 409);
    }
  }

  return prisma.inventoryItem.update({
    where: { id: itemId },
    data,
  });
};

export const createSupplier = async (restaurantId, data) => {
  return prisma.supplier.create({
    data: {
      restaurantId,
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
    },
  });
};

export const listSuppliers = async (restaurantId) => {
  return prisma.supplier.findMany({
    where: { restaurantId },
    orderBy: { name: "asc" },
  });
};

export const updateSupplier = async (restaurantId, supplierId, data) => {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, restaurantId },
  });

  if (!supplier) {
    throw createError("Supplier not found.", 404);
  }

  return prisma.supplier.update({
    where: { id: supplierId },
    data,
  });
};


export const receiveStock = async (restaurantId, userId, data) => {
  return prisma.$transaction(async (tx) => {
    if (data.supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: {
          id: data.supplierId,
          restaurantId,
          isActive: true,
        },
      });

      if (!supplier) {
        throw createError("Supplier not found or inactive.", 404);
      }
    }

    const receipt = await tx.stockReceipt.create({
      data: {
        restaurantId,
        supplierId: data.supplierId ?? null,
        reference: data.reference ?? null,
        notes: data.notes ?? null,
        status: "POSTED",
        receivedAt: new Date(),
      },
    });

    let totalCost = 0;

    for (const line of data.items) {
      const item = await tx.inventoryItem.findFirst({
        where: {
          id: line.inventoryItemId,
          restaurantId,
          isActive: true,
        },
      });

      if (!item) {
        throw createError(
          "One or more inventory items were not found or are inactive.",
          404
        );
      }

      const quantity = Number(line.quantity);
      const unitCost = Number(line.unitCost);
      const stockBefore = Number(item.currentStock);
      const stockAfter = stockBefore + quantity;
      const lineCost = quantity * unitCost;

      totalCost += lineCost;

      await tx.stockReceiptItem.create({
        data: {
          receiptId: receipt.id,
          inventoryItemId: item.id,
          quantity,
          unitCost,
          lineCost,
        },
      });

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          currentStock: { increment: quantity },
          costPerUnit: unitCost,
        },
      });

      await tx.stockMovement.create({
        data: {
          restaurantId,
          inventoryItemId: item.id,
          receiptId: receipt.id,
          type: "RECEIPT",
          quantity,
          stockBefore,
          stockAfter,
          referenceId: receipt.reference ?? receipt.id,
          notes: `Stock receipt ${receipt.id}`,
          performedBy: userId,
        },
      });
    }

    return tx.stockReceipt.update({
      where: { id: receipt.id },
      data: {
        totalCost,
      },
      include: {
        supplier: true,
        items: {
          include: { inventoryItem: true },
        },
      },
    });
  });
};


export const adjustStock = async (restaurantId, userId, data) => {
  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findFirst({
      where: {
        id: data.inventoryItemId,
        restaurantId,
        isActive: true,
      },
    });

    if (!item) {
      throw createError("Inventory item not found or inactive.", 404);
    }

    const quantity = Number(data.quantity);

    const decreasesStock = [
      "ADJUSTMENT_OUT",
      "WASTE",
    ].includes(data.type);

    // Atomically update stock while preventing negative balances.
    const updateResult = await tx.inventoryItem.updateMany({
      where: {
        id: item.id,
        restaurantId,
        isActive: true,
        ...(decreasesStock
          ? { currentStock: { gte: quantity } }
          : {}),
      },
      data: {
        currentStock: decreasesStock
          ? { decrement: quantity }
          : { increment: quantity },
        ...(data.unitCost !== undefined
          ? { costPerUnit: data.unitCost }
          : {}),
      },
    });

    if (updateResult.count !== 1) {
      throw createError(
        "Insufficient stock or inventory item unavailable. Refresh and try again.",
        409
      );
    }

    const updatedItem = await tx.inventoryItem.findFirst({
      where: {
        id: item.id,
        restaurantId,
      },
    });

    const stockAfter = Number(updatedItem.currentStock);

    const stockBefore = decreasesStock
      ? stockAfter + quantity
      : stockAfter - quantity;

    const movement = await tx.stockMovement.create({
      data: {
        restaurantId,
        inventoryItemId: item.id,
        type: data.type,
        quantity,
        stockBefore,
        stockAfter,
        referenceId: data.reference ?? null,
        notes: data.notes ?? null,
        performedBy: userId,
      },
    });

    return {
      item: updatedItem,
      movement,
    };
  });
};


export const listStockMovements = async (restaurantId, filters) => {
  const where = {
    restaurantId,
    ...(filters.inventoryItemId
      ? { inventoryItemId: filters.inventoryItemId }
      : {}),
    ...(filters.type ? { type: filters.type } : {}),
  };

  const [movements, total] = await prisma.$transaction([
    prisma.stockMovement.findMany({
      where,
      include: { inventoryItem: true },
      orderBy: { createdAt: "desc" },
      ...pagination(filters.page, filters.limit),
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return {
    movements,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      pages: Math.ceil(total / filters.limit),
    },
  };
};

export const getLowStockItems = async (restaurantId) => {
  const items = await prisma.inventoryItem.findMany({
    where: {
      restaurantId,
      isActive: true,
    },
    include: { category: true },
    orderBy: { name: "asc" },
  });

  return items.filter(
    (item) => Number(item.currentStock) <= Number(item.reorderLevel)
  );
};
