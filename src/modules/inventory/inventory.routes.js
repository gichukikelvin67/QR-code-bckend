
import { Router } from "express";

import {
  createInventoryCategoryController,
  listInventoryCategoriesController,
  updateInventoryCategoryController,
  createInventoryItemController,
  listInventoryItemsController,
  getInventoryItemController,
  updateInventoryItemController,
  createSupplierController,
  listSuppliersController,
  updateSupplierController,
  receiveStockController,
  adjustStockController,
  listStockMovementsController,
  getLowStockItemsController,
} from "./inventory.controller.js";

import {
  createInventoryCategorySchema,
  updateInventoryCategorySchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  createSupplierSchema,
  updateSupplierSchema,
  stockAdjustmentSchema,
  createStockReceiptSchema,
  inventoryIdParamsSchema,
  categoryIdParamsSchema,
  supplierIdParamsSchema,
  stockReceiptIdParamsSchema,
  inventoryListQuerySchema,
  stockMovementQuerySchema,
} from "./inventory.validation.js";

import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

const router = Router();

const managersOnly = authorize("OWNER", "ADMIN", "MANAGER");

const inventoryStaff = authorize(
  "OWNER",
  "ADMIN",
  "MANAGER",
  "INVENTORY_MANAGER"
);

const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: result.error.flatten(),
    });
  }

  req[source] = result.data;
  next();
};

router.use(authenticate);

// Categories
router.post(
  "/categories",
  managersOnly,
  validate(createInventoryCategorySchema),
  createInventoryCategoryController
);

router.get(
  "/categories",
  inventoryStaff,
  listInventoryCategoriesController
);

router.patch(
  "/categories/:categoryId",
  managersOnly,
  validate(categoryIdParamsSchema, "params"),
  validate(updateInventoryCategorySchema),
  updateInventoryCategoryController
);

// Inventory items
router.post(
  "/items",
  managersOnly,
  validate(createInventoryItemSchema),
  createInventoryItemController
);

router.get(
  "/items",
  inventoryStaff,
  validate(inventoryListQuerySchema, "query"),
  listInventoryItemsController
);

router.get(
  "/items/low-stock",
  inventoryStaff,
  getLowStockItemsController
);

router.get(
  "/items/:itemId",
  inventoryStaff,
  validate(inventoryIdParamsSchema, "params"),
  getInventoryItemController
);

router.patch(
  "/items/:itemId",
  managersOnly,
  validate(inventoryIdParamsSchema, "params"),
  validate(updateInventoryItemSchema),
  updateInventoryItemController
);

// Suppliers
router.post(
  "/suppliers",
  managersOnly,
  validate(createSupplierSchema),
  createSupplierController
);

router.get(
  "/suppliers",
  inventoryStaff,
  listSuppliersController
);

router.patch(
  "/suppliers/:supplierId",
  managersOnly,
  validate(supplierIdParamsSchema, "params"),
  validate(updateSupplierSchema),
  updateSupplierController
);

// Stock receiving and adjustments
router.post(
  "/receipts",
  inventoryStaff,
  validate(createStockReceiptSchema),
  receiveStockController
);

router.post(
  "/adjustments",
  inventoryStaff,
  validate(stockAdjustmentSchema),
  adjustStockController
);

// Movement history
router.get(
  "/movements",
  inventoryStaff,
  validate(stockMovementQuerySchema, "query"),
  listStockMovementsController
);

export default router;
