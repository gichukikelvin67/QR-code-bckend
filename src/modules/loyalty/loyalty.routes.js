
import { Router } from "express";

import {
  createCustomerController,
  listCustomersController,
  getCustomerController,
  updateCustomerController,
  awardPointsController,
  redeemPointsController,
  adjustPointsController,
  getCustomerLoyaltyHistoryController,
} from "./loyalty.controller.js";

import {
  createCustomerSchema,
  updateCustomerSchema,
  customerIdParamsSchema,
  redeemPointsSchema,
  adjustPointsSchema,
} from "./loyalty.validation.js";

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

const customerStaff = authorize(
  "OWNER",
  "ADMIN",
  "MANAGER",
  "CASHIER",
  "WAITER"
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

// Customer management
router.post(
  "/customers",
  customerStaff,
  validate(createCustomerSchema),
  createCustomerController
);

router.get(
  "/customers",
  customerStaff,
  listCustomersController
);

router.get(
  "/customers/:customerId",
  customerStaff,
  validate(customerIdParamsSchema, "params"),
  getCustomerController
);

router.patch(
  "/customers/:customerId",
  customerStaff,
  validate(customerIdParamsSchema, "params"),
  validate(updateCustomerSchema),
  updateCustomerController
);

// Redeem points against a bill
router.post(
  "/redeem",
  customerStaff,
  validate(redeemPointsSchema),
  redeemPointsController
);

// Manager-authorized points adjustment
router.post(
  "/customers/:customerId/adjust",
  managersOnly,
  validate(customerIdParamsSchema, "params"),
  validate(adjustPointsSchema),
  adjustPointsController
);

// Award points for a verified payment
router.post(
  "/payments/:paymentId/award",
  managersOnly,
  awardPointsController
);

// Customer loyalty history
router.get(
  "/customers/:customerId/history",
  customerStaff,
  validate(customerIdParamsSchema, "params"),
  getCustomerLoyaltyHistoryController
);

export default router;
