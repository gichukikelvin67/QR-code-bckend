
import { z } from "zod";

const employeeRoles = [
  "ADMIN",
  "MANAGER",
  "CASHIER",
  "WAITER",
  "KITCHEN",
  "BAR",
  "INVENTORY_MANAGER",
];

export const addEmployeeSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  role: z.enum(employeeRoles),
}).strict();

export const updateEmployeeRoleSchema = z.object({
  role: z.enum(employeeRoles),
}).strict();

export const employeeIdParamsSchema = z.object({
  employeeId: z.string().uuid(),
}).strict();

export const listEmployeesQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(employeeRoles).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();



export const updateEmployeeStatusSchema = z.object({
  isActive: z.boolean(),
}).strict();
