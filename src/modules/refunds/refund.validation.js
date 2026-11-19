
import { z } from "zod";

const moneyValue = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine(
    (value) => /^\d+(\.\d{1,2})?$/.test(value),
    "Enter a valid amount with up to 2 decimal places."
  )
  .refine(
    (value) => Number(value) > 0,
    "Refund amount must be greater than zero."
  );

export const createRefundSchema = z.object({
  paymentId: z.string().uuid("Invalid payment ID"),

  amount: moneyValue,

  reason: z
    .string()
    .trim()
    .min(3, "Please provide a refund reason.")
    .max(250, "Reason cannot exceed 250 characters."),

  idempotencyKey: z
    .string()
    .trim()
    .min(16, "Idempotency key must be at least 16 characters.")
    .max(100, "Idempotency key cannot exceed 100 characters."),
});

export const refundIdParamsSchema = z.object({
  refundId: z.string().uuid("Invalid refund ID"),
});

export const paymentIdParamsSchema = z.object({
  paymentId: z.string().uuid("Invalid payment ID"),
});

export const rejectRefundSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please provide a rejection reason.")
    .max(250, "Reason cannot exceed 250 characters."),
});
export const completeRefundSchema = z.object({
  providerReference: z
    .string()
    .trim()
    .min(3, "A valid provider reference is required.")
    .max(150, "Provider reference cannot exceed 150 characters."),
});