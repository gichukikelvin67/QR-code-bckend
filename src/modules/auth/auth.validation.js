

import { z } from "zod";

// Restaurant owner registration validation
export const registerSchema = z.object({
  restaurantName: z
    .string()
    .trim()
    .min(2, "Restaurant name must have at least 2 characters.")
    .max(100, "Restaurant name cannot exceed 100 characters."),

  name: z
    .string()
    .trim()
    .min(2, "Full name must have at least 2 characters.")
    .max(100),

  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .toLowerCase(),

  password: z
    .string()
    .min(8, "Password must contain at least 8 characters.")
    .max(100),
});

// Staff and owner login validation
export const loginSchema = z.object({
  restaurantSlug: z
    .string()
    .trim()
    .min(2, "Restaurant identifier is required."),

  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .toLowerCase(),

  password: z
    .string()
    .min(8, "Password must contain at least 8 characters.")
    .max(100),
});
//validates incoming data