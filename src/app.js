
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/auth.routes.js";
import restaurantRoutes from "./modules/restaurants/restaurant.routes.js";
import tableRoutes from "./modules/tables/table.routes.js";
import sessionRoutes from "./modules/sessions/session.routes.js";
import menuRoutes from "./modules/menu/menu.routes.js";
import publicMenuRoutes from "./modules/menu/public-menu.routes.js";
import publicOrderRoutes from "./modules/orders/public-order.routes.js";
import orderManagementRoutes from "./modules/orders/order-management.routes.js";
import kitchenRoutes from "./modules/kitchen/kitchen.routes.js";
import waiterRoutes from "./modules/waiters/waiter.routes.js";
import billingRoutes from "./modules/billing/billing.routes.js";
import barRoutes from "./modules/bar/bar.routes.js";
import mpesaRoutes from "./modules/payments/mpesa.routes.js";
import inventoryRoutes from "./modules/inventory/inventory.routes.js";
import recipeRoutes from "./modules/recipes/recipe.routes.js";
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
app.use("/api/tables", tableRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/menu",menuRoutes);
app.use("/api/public", publicMenuRoutes);
app.use("/api/public", publicOrderRoutes);
app.use("/api/orders", orderManagementRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/bar", barRoutes);
app.use("/api/waiters", waiterRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/payments/mpesa", mpesaRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/recipes", recipeRoutes);


app.use(notFoundHandler);

app.use(errorHandler);

export default app;
