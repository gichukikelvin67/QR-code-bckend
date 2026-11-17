
import http from "node:http";
import { Server } from "socket.io";

import app from "./app.js";
import prisma from "./config/database.js";
import { env } from "./config/env.js";
import { configureSocket } from "./sockets/socket.js";
import { setSocketInstance } from "./sockets/socket-instance.js";
import {
  startMpesaReconciliationJob,
  stopMpesaReconciliationJob,
} from "./jobs/mpesa-reconciliation.job.js";


async function startServer() {
  let server;
  let io;

  try {
    await prisma.$connect();

    console.log("Database connected successfully");
    startMpesaReconciliationJob();

    server = http.createServer(app);

    io = new Server(server, {
      cors: {
        origin: env.FRONTEND_URL,
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    app.set("io", io);

    configureSocket(io);
    setSocketInstance(io);

    server.listen(env.PORT, () => {
      console.log(
        `Restaurant API running on http://localhost:${env.PORT}`
      );
      console.log("Socket.IO server is ready");
    });

    let isShuttingDown = false;

    const shutdown = async () => {
      if (isShuttingDown) return;

      isShuttingDown = true;
      console.log("Shutting down server...");
      stopMpesaReconciliationJob();

      io.close();

      server.close(async () => {
        await prisma.$disconnect();
        console.log("Database disconnected");
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Server startup failed:", error);

    if (io) io.close();

    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
