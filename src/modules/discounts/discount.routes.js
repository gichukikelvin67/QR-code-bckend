
import { Router } from "express";

import {
  applyDiscountController,
  reverseDiscountController,
  listBillDiscountsController,
  getDiscountController,
} from "./discount.controller.js";

import {
  applyDiscountSchema,
  reverseDiscountSchema,
  discountIdParamsSchema,
  billIdParamsSchema,
} from "./discount.validation.js";

import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

const router = Router();

const managersOnly = authorize(
  "OWNER",
  "ADMIN",
  "MANAGER"
);

const validate = (schema, source = "body") => {
  return (req, res, next) => {
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
};

router.use(authenticate);

// Apply a discount to a bill
router.post(
  "/",
  managersOnly,
  validate(applyDiscountSchema),
  applyDiscountController
);

// List discounts belonging to a bill
router.get(
  "/bills/:billId",
  managersOnly,
  validate(billIdParamsSchema, "params"),
  listBillDiscountsController
);

// Get a discount by ID
router.get(
  "/:discountId",
  managersOnly,
  validate(discountIdParamsSchema, "params"),
  getDiscountController
);

// Reverse an existing discount
router.post(
  "/:discountId/reverse",
  managersOnly,
  validate(discountIdParamsSchema, "params"),
  validate(reverseDiscountSchema),
  reverseDiscountController
);

export default router;
