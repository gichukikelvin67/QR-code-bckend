
import {
  createInventoryCategory,
  listInventoryCategories,
  updateInventoryCategory,
  createInventoryItem,
  listInventoryItems,
  getInventoryItem,
  updateInventoryItem,
  createSupplier,
  listSuppliers,
  updateSupplier,
  receiveStock,
  adjustStock,
  listStockMovements,
  getLowStockItems,
} from "./inventory.service.js";

export const createInventoryCategoryController = async (req, res, next) => {
  try {
    const category = await createInventoryCategory(
      req.auth.restaurantId,
      req.auth.userId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Inventory category created.",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const listInventoryCategoriesController = async (req, res, next) => {
  try {
    const categories = await listInventoryCategories(req.auth.restaurantId);

    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

export const updateInventoryCategoryController = async (req, res, next) => {
  try {
    const category = await updateInventoryCategory(
      req.auth.restaurantId,
      req.auth.userId,
      req.params.categoryId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Inventory category updated.",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const createInventoryItemController = async (req, res, next) => {
  try {
    const item = await createInventoryItem(
      req.auth.restaurantId,
      req.auth.userId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Inventory item created.",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

export const listInventoryItemsController = async (req, res, next) => {
  try {
    const result = await listInventoryItems(
      req.auth.restaurantId,
      req.query
    );

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getInventoryItemController = async (req, res, next) => {
  try {
    const item = await getInventoryItem(
      req.auth.restaurantId,
      req.params.itemId
    );

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

export const updateInventoryItemController = async (req, res, next) => {
  try {
    const item = await updateInventoryItem(
      req.auth.restaurantId,
      req.auth.userId,
      req.params.itemId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Inventory item updated.",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

export const createSupplierController = async (req, res, next) => {
  try {
    const supplier = await createSupplier(
      req.auth.restaurantId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Supplier created.",
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

export const listSuppliersController = async (req, res, next) => {
  try {
    const suppliers = await listSuppliers(req.auth.restaurantId);

    res.status(200).json({ success: true, data: suppliers });
  } catch (error) {
    next(error);
  }
};

export const updateSupplierController = async (req, res, next) => {
  try {
    const supplier = await updateSupplier(
      req.auth.restaurantId,
      req.params.supplierId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Supplier updated.",
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

export const receiveStockController = async (req, res, next) => {
  try {
    const receipt = await receiveStock(
      req.auth.restaurantId,
      req.auth.userId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Stock received successfully.",
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
};

export const adjustStockController = async (req, res, next) => {
  try {
    const result = await adjustStock(
      req.auth.restaurantId,
      req.auth.userId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Stock adjusted successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const listStockMovementsController = async (req, res, next) => {
  try {
    const result = await listStockMovements(
      req.auth.restaurantId,
      req.query
    );

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getLowStockItemsController = async (req, res, next) => {
  try {
    const items = await getLowStockItems(req.auth.restaurantId);

    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    next(error);
  }
};
