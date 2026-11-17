
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(5000),

  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  // Safaricom Daraja configuration
  DARAJA_ENV: z
    .enum(["sandbox", "production"])
    .default("sandbox"),

  DARAJA_CONSUMER_KEY: z.string().min(1),
  DARAJA_CONSUMER_SECRET: z.string().min(1),
  DARAJA_SHORTCODE: z.string().min(1),
  DARAJA_PASSKEY: z.string().min(1),

  DARAJA_TRANSACTION_TYPE: z
    .enum([
      "CustomerPayBillOnline",
      "CustomerBuyGoodsOnline",
    ])
    .default("CustomerPayBillOnline"),

  DARAJA_CALLBACK_URL: z.string().url(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "Environment validation failed:",
    parsedEnv.error.flatten().fieldErrors
  );

  process.exit(1);
}

export const env = parsedEnv.data;

// Prevent application starting with missing or invalid configuration.
