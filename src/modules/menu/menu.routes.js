
import { Router } from "express";

import {
  createCategoryController,
  getCategoriesController,
  updateCategoryController,
  createMenuItemController,
  getMenuItemsController,
  getMenuItemController,
  updateMenuItemController,
} from "./menu.controller.js";

import {
  createCategorySchema,
  updateCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
} from "./menu.validation.js";

import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

const router = Router();

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: result.error.flatten(),
      });
    }

    req.body = result.data;
    next();
  };
}

const managersOnly = authorize(
  "OWNER",
  "ADMIN",
  "MANAGER"
);

router.use(authenticate);

// CATEGORIES
router.post(
  "/categories",
  managersOnly,
  validate(createCategorySchema),
  createCategoryController
);

router.get(
  "/categories",
  getCategoriesController
);

router.patch(
  "/categories/:categoryId",
  managersOnly,
  validate(updateCategorySchema),
  updateCategoryController
);

// MENU ITEMS
router.post(
  "/items",
  managersOnly,
  validate(createMenuItemSchema),
  createMenuItemController
);

router.get(
  "/items",
  getMenuItemsController
);

router.get(
  "/items/:itemId",
  getMenuItemController
);

router.patch(
  "/items/:itemId",
  managersOnly,
  validate(updateMenuItemSchema),
  updateMenuItemController
);

export default router;
