
import { Router } from "express";
import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";
import { createPreparationController } from "../preparation/preparation.controller.js";

const router = Router();

const kitchenController = createPreparationController("KITCHEN");

router.use(authenticate);

router.get(
  "/queue",
  authorize("OWNER", "ADMIN", "MANAGER", "KITCHEN"),
  kitchenController.getQueue
);

router.patch(
  "/items/:itemId/status",
  authorize("OWNER", "ADMIN", "MANAGER", "KITCHEN"),
  kitchenController.updateStatus
);

export default router;
