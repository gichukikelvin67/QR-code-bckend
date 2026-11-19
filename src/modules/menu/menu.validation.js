
import { z } from "zod";

const imageUrlSchema = z.string().trim().url().nullable().optional();

const priceSchema = z
  .number()
  .finite()
  .positive()
  .max(99999999.99)
  .refine(
    (value) => Number.isInteger(value * 100),
    "Price must have no more than two decimal places."
  );

// CATEGORY VALIDATION

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
}).strict();

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

// MENU ITEM VALIDATION

export const createMenuItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  price: priceSchema,
  imageUrl: imageUrlSchema,
  isAvailable: z.boolean().default(true),
  station: z.enum(["KITCHEN", "BAR"]).default("KITCHEN"),
}).strict();

export const updateMenuItemSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    price: priceSchema.optional(),
    imageUrl: imageUrlSchema,
    isAvailable: z.boolean().optional(),
    station: z.enum(["KITCHEN", "BAR"]).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });
