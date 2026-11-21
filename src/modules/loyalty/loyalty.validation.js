
import { z } from "zod";

const kenyanPhoneSchema = z
  .string()
  .trim()
  .regex(
    /^(?:\+254|254|0)(?:7\d{8}|1\d{8})$/,
    "Enter a valid Kenyan phone number."
  );

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(16, "Idempotency key must contain at least 16 characters.")
  .max(100, "Idempotency key cannot exceed 100 characters.");

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: kenyanPhoneSchema,
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("")),
}).strict();

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: kenyanPhoneSchema.optional(),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().optional(),
})
.strict()
.refine(
  (data) => Object.keys(data).length > 0,
  "Provide at least one field to update."
);

export const customerIdParamsSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID."),
}).strict();

export const paymentIdParamsSchema = z.object({
  paymentId: z.string().uuid("Invalid payment ID."),
}).strict();

export const redeemPointsSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID."),
  billId: z.string().uuid("Invalid bill ID."),
  points: z
    .number()
    .int()
    .min(50, "At least 50 points are required for redemption.")
    .max(100000000),
  idempotencyKey: idempotencyKeySchema,
}).strict();

export const adjustPointsSchema = z.object({
  points: z
    .number()
    .int()
    .safe()
    .refine(
      (value) => value !== 0,
      "Adjustment cannot be zero."
    ),
  description: z.string().trim().min(3).max(250),
  idempotencyKey: idempotencyKeySchema,
}).strict();
