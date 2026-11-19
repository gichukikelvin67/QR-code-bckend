import { z } from "zod";

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),

  action: z.string().trim().min(1).optional(),
  resource: z.string().trim().min(1).optional(),

  userId: z.string().uuid().optional(),

  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine(
  (data) => !data.from || !data.to || data.from <= data.to,
  {
    message: "The from date must be before or equal to the to date.",
    path: ["from"],
  }
);