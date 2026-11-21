
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

// Configure or update a customer's credit facility.
export const updateCustomerCreditSchema = z.object({
  allowCredit: z.boolean(),
  creditLimit: z.number()
    .finite()
    .min(0)
    .max(99999999.99)
    .refine(
      (value) => Number.isInteger(value * 100),
      "Credit limit must have no more than two decimal places."
    ),
}).strict().refine(
  (data) => !data.allowCredit || data.creditLimit > 0,
  {
    message: "An enabled credit facility must have a credit limit greater than zero.",
    path: ["creditLimit"],
  }
).refine(
  (data) => data.allowCredit || data.creditLimit === 0,
  {
    message: "Set the credit limit to zero when disabling credit.",
    path: ["creditLimit"],
  }
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
