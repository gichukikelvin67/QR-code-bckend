
import { Router } from "express";

import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

import { validate } from "../../middleware/validate.middleware.js";

import {
  createTabSchema,
  tabIdParamsSchema,
  attachBillSchema,
  closeTabSchema,
  suspendTabSchema,
  listTabsQuerySchema,
} from "./tab.validation.js";

import {
  createTab,
  getTabs,
  getTabById,
  attachBill,
  closeTab,
  suspendTab,
  reactivateTab,
} from "./tab.controller.js";

const router = Router();

router.use(authenticate);

// List and view tabs.
router.get(
  "/",
  validate(listTabsQuerySchema, "query"),
  getTabs
);

router.get(
  "/:tabId",
  validate(tabIdParamsSchema, "params"),
  getTabById
);

// Open a customer tab.
router.post(
  "/",
  authorize("OWNER", "ADMIN", "MANAGER"),
  validate(createTabSchema),
  createTab
);

// Attach an existing bill.
router.post(
  "/:tabId/bills",
  authorize("OWNER", "ADMIN", "MANAGER"),
  validate(tabIdParamsSchema, "params"),
  validate(attachBillSchema),
  attachBill
);

// Close a settled tab.
router.patch(
  "/:tabId/close",
  authorize("OWNER", "ADMIN", "MANAGER"),
  validate(tabIdParamsSchema, "params"),
  validate(closeTabSchema),
  closeTab
);

// Suspend a tab.
router.patch(
  "/:tabId/suspend",
  authorize("OWNER", "ADMIN", "MANAGER"),
  validate(tabIdParamsSchema, "params"),
  validate(suspendTabSchema),
  suspendTab
);

// Reactivate a suspended tab.
router.patch(
  "/:tabId/reactivate",
  authorize("OWNER", "ADMIN", "MANAGER"),
  validate(tabIdParamsSchema, "params"),
  reactivateTab
);

export default router;
