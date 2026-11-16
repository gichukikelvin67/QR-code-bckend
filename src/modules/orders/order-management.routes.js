
import { Router } from "express";

import {
  getOrdersController,
  getOrderController,
  updateOrderStatusController,
} from "./order-management.controller.js";

import {
  orderIdParamsSchema,
  orderListQuerySchema,
  updateOrderStatusSchema,
} from "./order-management.validation.js";

import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

const router = Router();

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters.",
        errors: result.error.flatten(),
      });
    }

    
    next();
  };
}

function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid route parameters.",
        errors: result.error.flatten(),
      });
    }

    next();
  };
}

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request body.",
        errors: result.error.flatten(),
      });
    }

    req.body = result.data;
    next();
  };
}

router.use(authenticate);

router.get(
  "/",
  validateQuery(orderListQuerySchema),
  getOrdersController
);

router.get(
  "/:orderId",
  validateParams(orderIdParamsSchema),
  getOrderController
);

router.patch(
  "/:orderId/status",
  authorize(
    "OWNER",
    "ADMIN",
    "MANAGER",
    "CASHIER",
    "WAITER",
    "KITCHEN",
    "BAR"
  ),
  validateParams(orderIdParamsSchema),
  validateBody(updateOrderStatusSchema),
  updateOrderStatusController
);

export default router;
