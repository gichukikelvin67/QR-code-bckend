
import { Router } from "express";

import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

import {
  analyticsOverview,
  salesTrends,
  paymentMethodsReport,
  topSellingItems,
  orderPerformance,
  inventoryInsights,
  staffPerformance,
} from "./analytics.controller.js";

import {
  exportAnalyticsController,
} from "./analytics-export.controller.js";

const router = Router();

router.use(authenticate);

router.get(
  "/overview",
  authorize("OWNER", "ADMIN", "MANAGER"),
  analyticsOverview
);

router.get(
  "/trends",
  authorize("OWNER", "ADMIN", "MANAGER"),
  salesTrends
);
router.get(
  "/payment-methods",
  authorize("OWNER", "ADMIN", "MANAGER"),
  paymentMethodsReport
);
router.get(
  "/top-selling-items",
  authorize("OWNER", "ADMIN", "MANAGER"),
  topSellingItems
);
router.get(
  "/order-performance",
  authorize("OWNER", "ADMIN", "MANAGER"),
  orderPerformance
);
router.get(
  "/inventory",
  authorize("OWNER", "ADMIN", "MANAGER"),
  inventoryInsights
);
router.get(
  "/staff-performance",
  authorize("OWNER", "ADMIN", "MANAGER"),
  staffPerformance
);
router.get(
  "/export/:report",
  authorize("OWNER", "ADMIN", "MANAGER"),
  exportAnalyticsController
);

export default router;
