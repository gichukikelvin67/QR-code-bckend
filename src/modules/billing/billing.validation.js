import { z } from "zod";

export const sessionIdParamsSchema = z.object({
  sessionId: z.string().uuid(),
});