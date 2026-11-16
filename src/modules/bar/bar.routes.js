
import { Router } from "express";
import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";
import { createPreparationController } from "../preparation/preparation.controller.js";

const router = Router();

const barController = createPreparationController("BAR");

router.use(authenticate);

router.get(
  "/queue",
  authorize("OWNER", "ADMIN", "MANAGER", "BAR"),
  barController.getQueue
);

router.patch(
  "/items/:itemId/status",
  authorize("OWNER", "ADMIN", "MANAGER", "BAR"),
  barController.updateStatus
);

export default router;
