
import { z } from "zod";

export const createPublicOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
        notes: z.string().trim().max(300).optional().nullable(),
      })
    )
    .min(1)
    .max(30)
    .refine(
      (items) =>
        new Set(items.map((item) => item.menuItemId)).size ===
        items.length,
      { message: "Each menu item must appear only once. Adjust its quantity instead." }
    ),

  notes: z.string().trim().max(1000).optional().nullable(),
});
