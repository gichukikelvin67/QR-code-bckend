
import { z } from "zod";

const uuidSchema = z.string().uuid();

const positiveQuantity = z.coerce.number().positive();
const nonNegativeQuantity = z.coerce.number().min(0);

const optionalText = (max = 500) =>
  z.string().trim().max(max).optional().nullable();

export const createInventoryCategorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: optionalText(500),
});

export const updateInventoryCategorySchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: optionalText(500),
  isActive: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided." }
);

export const createInventoryItemSchema = z.object({
  categoryId: uuidSchema.optional().nullable(),
  name: z.string().trim().min(2).max(150),
  sku: z.string().trim().max(80).optional().nullable(),
  description: optionalText(500),
  unit: z.enum(["KG", "G", "L", "ML", "PIECE", "PACKET"]),
  currentStock: nonNegativeQuantity.default(0),
  reorderLevel: nonNegativeQuantity.default(0),
  costPerUnit: nonNegativeQuantity.default(0),
});

export const updateInventoryItemSchema = z.object({
  categoryId: uuidSchema.optional().nullable(),
  name: z.string().trim().min(2).max(150).optional(),
  sku: z.string().trim().max(80).optional().nullable(),
  description: optionalText(500),
  unit: z.enum(["KG", "G", "L", "ML", "PIECE", "PACKET"]).optional(),
  reorderLevel: nonNegativeQuantity.optional(),
  costPerUnit: nonNegativeQuantity.optional(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided." }
);

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2).max(150),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  address: optionalText(300),
});

export const updateSupplierSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  address: optionalText(300),
  isActive: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided." }
);

export const stockAdjustmentSchema = z.object({
  inventoryItemId: uuidSchema,
  type: z.enum(["ADJUSTMENT_IN", "ADJUSTMENT_OUT", "WASTE", "RETURN"]),
  quantity: positiveQuantity,
  unitCost: nonNegativeQuantity.optional(),
  reference: z.string().trim().max(100).optional().nullable(),
  notes: optionalText(500),
});

export const createStockReceiptSchema = z.object({
  supplierId: uuidSchema.optional().nullable(),
  reference: z.string().trim().max(100).optional().nullable(),
  notes: optionalText(500),
  items: z.array(
    z.object({
      inventoryItemId: uuidSchema,
      quantity: positiveQuantity,
      unitCost: nonNegativeQuantity,
    })
  ).min(1).max(100),
});

export const inventoryIdParamsSchema = z.object({
  itemId: uuidSchema,
});

export const categoryIdParamsSchema = z.object({
  categoryId: uuidSchema,
});

export const supplierIdParamsSchema = z.object({
  supplierId: uuidSchema,
});

export const stockReceiptIdParamsSchema = z.object({
  receiptId: uuidSchema,
});

export const inventoryListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: uuidSchema.optional(),
  lowStock: z.enum(["true", "false"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const stockMovementQuerySchema = z.object({
  inventoryItemId: uuidSchema.optional(),
  type: z.enum([
    "RECEIPT",
    "ADJUSTMENT_IN",
    "ADJUSTMENT_OUT",
    "RECIPE_DEDUCTION",
    "WASTE",
    "RETURN",
  ]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
