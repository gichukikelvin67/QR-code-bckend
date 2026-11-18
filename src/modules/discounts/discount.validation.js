
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
    "Value must be greater than zero."
  );

export const applyDiscountSchema = z.object({
  billId: z.string().uuid("Invalid bill ID"),

  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),

  value: moneyValue,

  reason: z
    .string()
    .trim()
    .min(3, "Please provide a reason for the discount.")
    .max(250, "Reason cannot exceed 250 characters."),
}).superRefine((data, ctx) => {
  if (
    data.type === "PERCENTAGE" &&
    Number(data.value) > 100
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "Percentage discount cannot exceed 100%.",
    });
  }
});

export const discountIdParamsSchema = z.object({
  discountId: z.string().uuid("Invalid discount ID"),
});

export const billIdParamsSchema = z.object({
  billId: z.string().uuid("Invalid bill ID"),
});

export const reverseDiscountSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please provide a reversal reason.")
    .max(250, "Reason cannot exceed 250 characters."),
});
