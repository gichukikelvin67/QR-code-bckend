
import { Router } from "express";

import {
  requestRefundController,
  approveRefundController,
  completeRefundController,
  rejectRefundController,
  listPaymentRefundsController,
  getRefundController,
} from "./refund.controller.js";

import {
  createRefundSchema,
  refundIdParamsSchema,
  paymentIdParamsSchema,
  rejectRefundSchema,
  completeRefundSchema,
} from "./refund.validation.js";

import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

const router = Router();

const managersOnly = authorize(
  "OWNER",
  "ADMIN",
  "MANAGER"
);

const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: result.error.flatten(),
      });
    }

    req[source] = result.data;
    next();
  };
};

router.use(authenticate);

// Submit a refund request
router.post(
  "/",
  managersOnly,
  validate(createRefundSchema),
  requestRefundController
);

// List refunds for a payment
router.get(
  "/payments/:paymentId",
  managersOnly,
  validate(paymentIdParamsSchema, "params"),
  listPaymentRefundsController
);

// Get a refund
router.get(
  "/:refundId",
  managersOnly,
  validate(refundIdParamsSchema, "params"),
  getRefundController
);

// Approve a refund
router.patch(
  "/:refundId/approve",
  managersOnly,
  validate(refundIdParamsSchema, "params"),
  approveRefundController
);

// Reject a refund
router.patch(
  "/:refundId/reject",
  managersOnly,
  validate(refundIdParamsSchema, "params"),
  validate(rejectRefundSchema),
  rejectRefundController
);

// Record externally confirmed refund completion

router.patch(
  "/:refundId/complete",
  managersOnly,
  validate(refundIdParamsSchema, "params"),
  validate(completeRefundSchema),
  completeRefundController
);
export default router;
