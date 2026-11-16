
import { z } from "zod";

const tableStatus = z.enum([
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
  "OUT_OF_SERVICE",
]);

export const createTableSchema = z.object({
  tableNumber: z.string().trim().min(1).max(30),
  capacity: z.number().int().min(1).max(50).default(2),
});

export const updateTableSchema = z
  .object({
    tableNumber: z.string().trim().min(1).max(30).optional(),
    capacity: z.number().int().min(1).max(50).optional(),
    status: tableStatus.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });
