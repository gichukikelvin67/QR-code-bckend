
import { Router } from "express";

import {
  getRestaurant,
  updateRestaurantDetails,
} from "./restaurant.controller.js";

import { updateRestaurantSchema } from "./restaurant.validation.js";

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
        errors: result.error.flatten().fieldErrors,
      });
    }

    req.body = result.data;
    next();
  };
}

// Any authenticated restaurant member can view their restaurant.
router.get("/current", authenticate, getRestaurant);

// Only authorized management roles can update details.
router.patch(
  "/current",
  authenticate,
  authorize("OWNER", "ADMIN", "MANAGER"),
  validate(updateRestaurantSchema),
  updateRestaurantDetails
);

export default router;
