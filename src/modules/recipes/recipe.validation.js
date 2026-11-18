
import { z } from "zod";

const uuidSchema = z.string().uuid();

export const createRecipeIngredientSchema = z.object({
  inventoryItemId: uuidSchema,
  quantity: z.coerce.number().positive(),
});

export const updateRecipeIngredientSchema = z.object({
  quantity: z.coerce.number().positive(),
});

export const menuItemParamsSchema = z.object({
  menuItemId: uuidSchema,
});

export const recipeIngredientParamsSchema = z.object({
  ingredientId: uuidSchema,
});
