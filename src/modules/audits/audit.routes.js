import { Router } from "express";
import { authenticate, authorize } from "../auth/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { listAuditLogsQuerySchema } from "./audit.validation.js";
import { getAuditLogs } from "./audit.controller.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("OWNER", "ADMIN", "MANAGER"),
  validate(listAuditLogsQuerySchema, "query"),
  getAuditLogs
);

export default router;