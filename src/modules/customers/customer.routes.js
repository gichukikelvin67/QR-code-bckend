
import { Router } from "express";

import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

import { validate } from "../../middleware/validate.middleware.js";

import {
  createCustomerSchema,
  updateCustomerSchema,
  customerIdParamsSchema,
  listCustomersQuerySchema,
} from "./customer.validation.js";

import {
  createCustomerHandler,
  listCustomersHandler,
  getCustomerHandler,
  updateCustomerHandler,
} from "./customer.controller.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  validate(listCustomersQuerySchema, "query"),
  listCustomersHandler
);

router.post(
  "/",
  authorize("OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"),
  validate(createCustomerSchema),
  createCustomerHandler
);

router.get(
  "/:customerId",
  validate(customerIdParamsSchema, "params"),
  getCustomerHandler
);

router.patch(
  "/:customerId",
  authorize("OWNER", "ADMIN", "MANAGER", "CASHIER"),
  validate(customerIdParamsSchema, "params"),
  validate(updateCustomerSchema),
  updateCustomerHandler
);

export default router;
