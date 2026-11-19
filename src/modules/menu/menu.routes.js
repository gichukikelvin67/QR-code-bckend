
import { Router } from "express";
import { z } from "zod";

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

import { validate } from "../../middleware/validate.middleware.js";

const router = Router();

const managersOnly = authorize(
  "OWNER",
  "ADMIN",
  "MANAGER"
);

const categoryIdParamsSchema = z.object({
  categoryId: z.string().uuid(),
});

const itemIdParamsSchema = z.object({
  itemId: z.string().uuid(),
});

const menuItemsQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  availableOnly: z.enum(["true", "false"]).optional(),
});

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
  validate(categoryIdParamsSchema, "params"),
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
  validate(menuItemsQuerySchema, "query"),
  getMenuItemsController
);

router.get(
  "/items/:itemId",
  validate(itemIdParamsSchema, "params"),
  getMenuItemController
);

router.patch(
  "/items/:itemId",
  managersOnly,
  validate(itemIdParamsSchema, "params"),
  validate(updateMenuItemSchema),
  updateMenuItemController
);

export default router;
