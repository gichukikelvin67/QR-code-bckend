
import { Router } from "express";

import { createPublicOrderController } from "./order.controller.js";
import { createPublicOrderSchema } from "./order.validation.js";
import {
  publicMenuParamsSchema,
  publicMenuQuerySchema,
} from "../menu/public-menu.validation.js";

const router = Router();

function validatePublicOrder(req, res, next) {
  const paramsResult = publicMenuParamsSchema.safeParse(
    req.params
  );

  const queryResult = publicMenuQuerySchema.safeParse(
    req.query
  );

  const bodyResult = createPublicOrderSchema.safeParse(
    req.body
  );

  if (
    !paramsResult.success ||
    !queryResult.success ||
    !bodyResult.success
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid order request.",
      errors: {
        params: paramsResult.success
          ? undefined
          : paramsResult.error.flatten(),
        query: queryResult.success
          ? undefined
          : queryResult.error.flatten(),
        body: bodyResult.success
          ? undefined
          : bodyResult.error.flatten(),
      },
    });
  }

  req.body = bodyResult.data;
  next();
}

router.post(
  "/:restaurantSlug/orders",
  validatePublicOrder,
  createPublicOrderController
);

export default router;
