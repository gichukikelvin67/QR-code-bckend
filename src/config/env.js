import dotenv from"dotenv";
import {z}from "zod";
dotenv.config();
const envSchema=z.object({
    NODE_ENV:z
    .enum(["development","prodction","test"])
    .default("development"),

    PORT:z.coerce.number().int().positive().default(5000),
    DATABASE_URL:z.string().min(1),
    FRONTEND_URL:z.string().url(),
    JWT_ACCESS_SECRET:z.string().min(32),
    JWT_REFRESH_SECRET:z.string().min(32),
})
const parsedEnv=envSchema.safeParse(process.env);
if(!parsedEnv.success){
    console.error(
        "Enviroment validation failed:",
        parsedEnv.error.flatten().fieldErrors
    );
    process.exit(1);
}
export const env=parsedEnv.data;
//prevent application starting  with missing or invalid configuration