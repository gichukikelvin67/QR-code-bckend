
import { z } from "zod";

export const updateRestaurantSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Restaurant name must have at least 2 characters.")
      .max(100)
      .optional(),

    email: z
      .string()
      .trim()
      .email("Enter a valid business email.")
      .nullable()
      .optional(),

    phone: z
      .string()
      .trim()
      .min(7, "Enter a valid phone number.")
      .max(20)
      .nullable()
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Provide at least one restaurant field to update."
  );
