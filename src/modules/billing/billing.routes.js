import { Router } from "express";
import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

import {
  generateBillController,
} from "./billing.controller.js";

const router = Router();

router.use(authenticate);

router.post(
  "/sessions/:sessionId/bills",
  authorize("OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"),
  generateBillController
);

export default router;