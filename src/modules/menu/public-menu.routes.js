
import { Router } from "express";

import { getPublicMenuController } from "./public-menu.controller.js";

import {
  publicMenuParamsSchema,
  publicMenuQuerySchema,
} from "./public-menu.validation.js";

const router = Router();

function validatePublicMenu(req, res, next) {
  const paramsResult = publicMenuParamsSchema.safeParse(
    req.params
  );

  const queryResult = publicMenuQuerySchema.safeParse(
    req.query
  );

  if (!paramsResult.success || !queryResult.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid restaurant or table QR details.",
      errors: {
        params: paramsResult.success
          ? undefined
          : paramsResult.error.flatten(),
        query: queryResult.success
          ? undefined
          : queryResult.error.flatten(),
      },
    });
  }

  next();
}

router.get(
  "/:restaurantSlug/menu",
  validatePublicMenu,
  getPublicMenuController
);

export default router;
