
import { Router } from "express";

import {
  authenticate,
  authorize,
} from "../auth/auth.middleware.js";

import { validate } from "../../middleware/validate.middleware.js";

import {
  addEmployeeSchema,
  updateEmployeeRoleSchema,
  updateEmployeeStatusSchema,
  employeeIdParamsSchema,
  listEmployeesQuerySchema,
} from "./employee.validation.js";

import {
  createEmployee,
  getEmployees,
  getEmployeeById,
  changeEmployeeRole,
  changeEmployeeStatus,
} from "./employee.controller.js";

const router = Router();

router.use(authenticate);

// All restaurant staff can view the employee directory.
router.get(
  "/",
  validate(listEmployeesQuerySchema, "query"),
  getEmployees
);

// Add an existing registered user to the restaurant.
router.post(
  "/",
  authorize("OWNER", "ADMIN"),
  validate(addEmployeeSchema),
  createEmployee
);

// View one employee.
router.get(
  "/:employeeId",
  validate(employeeIdParamsSchema, "params"),
  getEmployeeById
);

// Change an employee's restaurant role.
router.patch(
  "/:employeeId/role",
  authorize("OWNER", "ADMIN"),
  validate(employeeIdParamsSchema, "params"),
  validate(updateEmployeeRoleSchema),
  changeEmployeeRole
);

// Activate or deactivate an employee's restaurant membership.
router.patch(
  "/:employeeId/status",
  authorize("OWNER", "ADMIN"),
  validate(employeeIdParamsSchema, "params"),
  validate(updateEmployeeStatusSchema),
  changeEmployeeStatus
);

export default router;
