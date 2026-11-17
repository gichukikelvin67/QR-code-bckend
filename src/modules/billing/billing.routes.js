import { Router } from "express";
import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

import {
  generateBillController,
  listBillsController,
  getBillController,
  splitBillController,
  recordPaymentController,
} from "./billing.controller.js";

const router = Router();

router.use(authenticate);

router.post(
  "/sessions/:sessionId/bills",
  authorize("OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"),
  generateBillController
);

router.post(
  "/:billId/split",
  authorize("OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"),
  splitBillController,
  
);

router.post(
  "/:billId/payments",
  authorize("OWNER", "ADMIN", "MANAGER", "CASHIER"),
  recordPaymentController
);

router.get(
  "/",
  authorize("OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"),
  listBillsController
);

router.get(
  "/:billId",
  authorize("OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"),
  getBillController
);
export default router;