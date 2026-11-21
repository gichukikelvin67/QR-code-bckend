
import { z } from "zod";

export const createTabSchema = z.object({
  customerId: z.string().uuid(),
  notes: z.string().trim().max(500).optional(),
}).strict();

export const tabIdParamsSchema = z.object({
  tabId: z.string().uuid(),
}).strict();

export const attachBillSchema = z.object({
  billId: z.string().uuid(),
}).strict();

export const closeTabSchema = z.object({
  notes: z.string().trim().max(500).optional(),
}).strict();

export const suspendTabSchema = z.object({
  reason: z.string().trim().min(3).max(500),
}).strict();

export const listTabsQuerySchema = z.object({
  status: z.enum(["OPEN", "CLOSED", "SUSPENDED"]).optional(),
  customerId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
