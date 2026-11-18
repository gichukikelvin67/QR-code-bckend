
import { z } from "zod";

export const orderIdParamsSchema = z.object({
  orderId: z.string().uuid(),
});

export const orderListQuerySchema = z.object({
  status: z
    .enum([
      "PENDING",
      "ACCEPTED",
      "PREPARING",
      "READY",
      "SERVED",
      "CANCELLED",
    ])
    .optional(),
});
export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "ACCEPTED",
    "PREPARING",
    "READY",
    "SERVED",
    "CANCELLED",
  ]),
});
