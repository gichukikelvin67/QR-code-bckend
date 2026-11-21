
import { z } from "zod";

const MAX_REPORTING_DAYS = 366;
const DEFAULT_TOP_ITEMS_LIMIT = 10;
const MAX_TOP_ITEMS_LIMIT = 100;

const dateString = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must use YYYY-MM-DD format"
  )
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar date");

const dateRangeSchema = z
  .object({
    from: dateString.optional(),
    to: dateString.optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (!data.from || !data.to) return true;
      return data.from <= data.to;
    },
    {
      message: "'from' must be before or equal to 'to'",
      path: ["from"],
    }
  )
  .refine(
    (data) => {
      if (!data.from || !data.to) return true;

      const from = new Date(`${data.from}T00:00:00.000Z`);
      const to = new Date(`${data.to}T00:00:00.000Z`);

      const difference =
        (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);

      return difference < MAX_REPORTING_DAYS;
    },
    {
      message: `Reporting period cannot exceed ${MAX_REPORTING_DAYS} calendar days`,
      path: ["to"],
    }
  );

export const analyticsDateRangeQuerySchema = dateRangeSchema;

// Retain the existing export so existing imports continue working.
export const analyticsOverviewQuerySchema = dateRangeSchema;

export const analyticsTopSellingQuerySchema = dateRangeSchema.extend({
  limit: z.coerce
    .number()
    .int("Limit must be a whole number")
    .min(1, "Limit must be at least 1")
    .max(
      MAX_TOP_ITEMS_LIMIT,
      `Limit cannot exceed ${MAX_TOP_ITEMS_LIMIT}`
    )
    .default(DEFAULT_TOP_ITEMS_LIMIT),
});

export const analyticsExportQuerySchema = dateRangeSchema;
