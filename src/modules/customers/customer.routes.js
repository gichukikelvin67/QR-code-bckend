
import { Router } from "express";

import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

import { validate } from "../../middleware/validate.middleware.js";

import {
  createCustomerSchema,
  updateCustomerSchema,
  updateCustomerCreditSchema,
  customerIdParamsSchema,
  listCustomersQuerySchema,
} from "./customer.validation.js";

import {
  createCustomerHandler,
  listCustomersHandler,
  getCustomerHandler,
  updateCustomerHandler,
  updateCustomerCreditHandler,
} from "./customer.controller.js";

const router = Router();

router.use(authenticate);

// List customers
router.get(
  "/",
  validate(listCustomersQuerySchema, "query"),
  listCustomersHandler
);

// Create customer
router.post(
  "/",
  authorize("OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"),
  validate(createCustomerSchema),
  createCustomerHandler
);

// Update customer credit facility
router.patch(
  "/:customerId/credit",
  authorize("OWNER", "ADMIN", "MANAGER"),
  validate(customerIdParamsSchema, "params"),
  validate(updateCustomerCreditSchema),
  updateCustomerCreditHandler
);

// Get customer
router.get(
  "/:customerId",
  validate(customerIdParamsSchema, "params"),
  getCustomerHandler
);

// Update customer details
router.patch(
  "/:customerId",
  authorize("OWNER", "ADMIN", "MANAGER", "CASHIER"),
  validate(customerIdParamsSchema, "params"),
  validate(updateCustomerSchema),
  updateCustomerHandler
);

export default router;
