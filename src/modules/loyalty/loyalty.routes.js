
import { Router } from "express";

import {
  awardPointsController,
  redeemPointsController,
  adjustPointsController,
  getCustomerLoyaltyHistoryController,
} from "./loyalty.controller.js";

import {
  customerIdParamsSchema,
  paymentIdParamsSchema,
  redeemPointsSchema,
  adjustPointsSchema,
} from "./loyalty.validation.js";

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

const customerStaff = authorize(
  "OWNER",
  "ADMIN",
  "MANAGER",
  "CASHIER",
  "WAITER"
);

router.use(authenticate);

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

// Manual award endpoint.
// Automatic awards should be triggered by verified payment processing.
router.post(
  "/payments/:paymentId/award",
  managersOnly,
  validate(paymentIdParamsSchema, "params"),
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
