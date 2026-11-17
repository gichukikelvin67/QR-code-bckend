import { z } from "zod";

export const stkPushSchema = z.object({
  billId: z.string().uuid(),

  phoneNumber: z
    .string()
    .trim()
    .regex(
      /^(?:\+?254|0)(?:7\d{8}|1\d{8})$/,
      "Enter a valid Kenyan Safaricom phone number"
    ),

  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount")
    .refine(
      (value) => Number(value) > 0,
      "Amount must be greater than zero"
    )
    .refine(
      (value) => Number.isInteger(Number(value)),
      "M-Pesa STK Push amounts must be whole KES"
    ),

  idempotencyKey: z.string().min(16).max(100),
});