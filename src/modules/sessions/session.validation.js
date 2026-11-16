
import { z } from "zod";

export const openSessionSchema = z.object({
  tableId: z.string().uuid(),
});

export const sessionIdSchema = z.object({
  sessionId: z.string().uuid(),
});
