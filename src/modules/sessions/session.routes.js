
import { Router } from "express";

import {
  openSessionController,
  getSessionsController,
  getSessionController,
  closeSessionController,
} from "./session.controller.js";

import { openSessionSchema } from "./session.validation.js";

import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

const router = Router();

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: result.error.flatten(),
      });
    }

    req.body = result.data;
    next();
  };
}

router.use(authenticate);

router.post(
  "/",
  authorize("OWNER", "ADMIN", "MANAGER", "WAITER", "CASHIER"),
  validate(openSessionSchema),
  openSessionController
);

router.get("/", getSessionsController);

router.get("/:sessionId", getSessionController);

router.patch(
  "/:sessionId/close",
  authorize("OWNER", "ADMIN", "MANAGER", "WAITER", "CASHIER"),
  closeSessionController
);

export default router;
