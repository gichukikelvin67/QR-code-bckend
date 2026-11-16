
import { Router } from "express";

import {
  register,
  loginUser,
  refresh,
  logoutUser,
  getCurrentUser,
} from "./auth.controller.js";

import {
  registerSchema,
  loginSchema,
} from "./auth.validation.js";

import { authenticate } from "./auth.middleware.js";

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

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), loginUser);
router.post("/refresh", refresh);
router.post("/logout", logoutUser);
router.get("/me", authenticate, getCurrentUser);

export default router;
