
import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export const createMenuItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  price: z.number().positive().max(99999999.99),
  imageUrl: z.string().url().optional().nullable(),
  isAvailable: z.boolean().default(true),
});

export const updateMenuItemSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    price: z.number().positive().max(99999999.99).optional(),
    imageUrl: z.string().url().nullable().optional(),
    isAvailable: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });
