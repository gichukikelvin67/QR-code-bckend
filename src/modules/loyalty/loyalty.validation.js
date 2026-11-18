
import { z } from "zod";

const kenyanPhoneSchema = z
  .string()
  .trim()
  .regex(
    /^(?:\+254|254|0)(?:7\d{8}|1\d{8})$/,
    "Enter a valid Kenyan phone number."
  );

export const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Customer name is required.")
    .max(100),

  phone: kenyanPhoneSchema,

  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("")),
});

export const updateCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .optional(),

  phone: kenyanPhoneSchema.optional(),

  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal("")),

  isActive: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  "Provide at least one field to update."
);

export const customerIdParamsSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID."),
});

export const redeemPointsSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID."),
  billId: z.string().uuid("Invalid bill ID."),
  points: z
    .number()
    .int("Points must be a whole number.")
    .positive("Points must be greater than zero."),
  idempotencyKey: z
    .string()
    .trim()
    .min(16)
    .max(100),
});

export const adjustPointsSchema = z.object({
  points: z
    .number()
    .int()
    .refine((value) => value !== 0, "Adjustment cannot be zero."),

  description: z
    .string()
    .trim()
    .min(3)
    .max(250),

  idempotencyKey: z
    .string()
    .trim()
    .min(16)
    .max(100),
});
