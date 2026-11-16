
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/auth.routes.js";
import restaurantRoutes from "./modules/restaurants/restaurant.routes.js";

import { env } from "./config/env.js";

import healthRoutes from "./routes/health.routes.js";

import {
  notFoundHandler,
  errorHandler,
} from "./middleware/error.middleware.js";

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Restaurant Platform API",
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/auth", authRoutes);


app.use(notFoundHandler);

app.use(errorHandler);

export default app;
