
import app from "./app.js";
import prisma from "./config/database.js";
import { env } from "./config/env.js";

async function startServer() {
  try {
    await prisma.$connect();

    console.log("Database connected successfully");

    const server = app.listen(env.PORT, () => {
      console.log(
        `Restaurant API running on http://localhost: ${env.PORT}`
      );
    });

    const shutdown = async () => {
      console.log("Shutting down server...");

      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

  } catch (error) {
    console.error("Server startup failed:", error);

    await prisma.$disconnect();

    process.exit(1);
  }
}

startServer();
