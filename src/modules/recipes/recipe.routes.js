
import { Router } from "express";

import {
  addRecipeIngredientController,
  getMenuItemRecipeController,
  updateRecipeIngredientController,
  removeRecipeIngredientController,
} from "./recipe.controller.js";

import {
  createRecipeIngredientSchema,
  updateRecipeIngredientSchema,
  menuItemParamsSchema,
  recipeIngredientParamsSchema,
} from "./recipe.validation.js";

import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

const router = Router();

const managersOnly = authorize("OWNER", "ADMIN", "MANAGER");

const recipeStaff = authorize(
  "OWNER",
  "ADMIN",
  "MANAGER",
  "INVENTORY_MANAGER",
  "KITCHEN"
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

// View a menu item's recipe
router.get(
  "/menu-items/:menuItemId",
  recipeStaff,
  validate(menuItemParamsSchema, "params"),
  getMenuItemRecipeController
);

// Add an ingredient
router.post(
  "/menu-items/:menuItemId/ingredients",
  managersOnly,
  validate(menuItemParamsSchema, "params"),
  validate(createRecipeIngredientSchema),
  addRecipeIngredientController
);

// Update an ingredient quantity
router.patch(
  "/ingredients/:ingredientId",
  managersOnly,
  validate(recipeIngredientParamsSchema, "params"),
  validate(updateRecipeIngredientSchema),
  updateRecipeIngredientController
);

// Remove an ingredient
router.delete(
  "/ingredients/:ingredientId",
  managersOnly,
  validate(recipeIngredientParamsSchema, "params"),
  removeRecipeIngredientController
);

export default router;
