
import { z } from "zod";

const phoneRegex = /^\+?[0-9]{10,15}$/;

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(phoneRegex, "Enter a valid phone number."),
  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal("")),
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().regex(phoneRegex, "Enter a valid phone number.").optional(),
  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "Provide at least one field to update." }
);

export const customerIdParamsSchema = z.object({
  customerId: z.string().uuid(),
});

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});
