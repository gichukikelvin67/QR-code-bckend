
import express from "express";
import cors from "cors";
import helmet from "helmet";

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

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Restaurant Platform API",
  });
});

app.use("/api/health", healthRoutes);

app.use(notFoundHandler);

app.use(errorHandler);

export default app;
