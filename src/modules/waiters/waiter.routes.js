
import { Router } from "express";
import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

import {
  getWaiterQueueController,
  serveOrderItemController,
} from "./waiter.controller.js";

const router = Router();

router.use(authenticate);

router.get(
  "/queue",
  authorize("OWNER", "ADMIN", "MANAGER", "WAITER"),
  getWaiterQueueController
);

router.patch(
  "/items/:itemId/serve",
  authorize("OWNER", "ADMIN", "MANAGER", "WAITER"),
  serveOrderItemController
);

export default router;
