
import { Router } from "express";

import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

import {
  initiateStkPushController,
  queryStkPushController,
  getMpesaPaymentStatusController,
} from "./mpesa.controller.js";

import {
  mpesaCallbackController,
} from "./mpesa.callback.controller.js";

const router = Router();

// Public endpoint: Safaricom calls this directly.
router.post(
  "/callback",
  mpesaCallbackController
);

// Protected endpoint: staff initiate payments.
router.post(
  "/stk-push",
  authenticate,
  authorize("OWNER", "ADMIN", "MANAGER", "CASHIER"),
  initiateStkPushController
);

// Protected endpoint: staff check payment status.
router.post(
  "/payments/:paymentId/stk-query",
  authenticate,
  authorize("OWNER", "ADMIN", "MANAGER", "CASHIER"),
  queryStkPushController
);
router.get(
  "/payments/:paymentId",
  authenticate,
  authorize("OWNER", "ADMIN", "MANAGER", "CASHIER"),
  getMpesaPaymentStatusController
);

export default router;
