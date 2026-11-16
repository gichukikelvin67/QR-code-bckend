
import { Router } from "express";

import {
  createTableController,
  getTablesController,
  getTableController,
  updateTableController,
  getTableQRCodeController,
} from "./table.controller.js";

import {
  createTableSchema,
  updateTableSchema,
} from "./table.validation.js";

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
  authorize("OWNER", "ADMIN", "MANAGER"),
  validate(createTableSchema),
  createTableController
);

router.get("/", getTablesController);

router.get("/:tableId/qr", getTableQRCodeController);

router.get("/:tableId", getTableController);

router.patch(
  "/:tableId",
  authorize("OWNER", "ADMIN", "MANAGER"),
  validate(updateTableSchema),
  updateTableController
);

export default router;
