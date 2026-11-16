
import { z } from "zod";

export const publicMenuParamsSchema = z.object({
  restaurantSlug: z.string().trim().min(2),
});

export const publicMenuQuerySchema = z.object({
  table: z.string().uuid(),
});
