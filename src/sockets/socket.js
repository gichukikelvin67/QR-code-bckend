
import jwt from "jsonwebtoken";
import prisma from "../config/database.js";
import { env } from "../config/env.js";

export function configureSocket(io) {
  // Authenticate every Socket.IO connection.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.accessToken;

      if (!token) {
        return next(new Error("Authentication required."));
      }

      let payload;

      try {
        payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
      } catch {
        return next(new Error("Invalid or expired access token."));
      }

      const membership = await prisma.membership.findFirst({
        where: {
          id: payload.membershipId,
          userId: payload.sub,
          restaurantId: payload.restaurantId,
          isActive: true,
          user: {
            isActive: true,
          },
          restaurant: {
            isActive: true,
          },
        },
        select: {
          id: true,
          userId: true,
          restaurantId: true,
          role: true,
        },
      });

      if (!membership) {
        return next(
          new Error("Your restaurant membership is inactive.")
        );
      }

      socket.data.auth = {
        userId: membership.userId,
        restaurantId: membership.restaurantId,
        membershipId: membership.id,
        role: membership.role,
      };

      next();
    } catch (error) {
      console.error("Socket authentication failed:", error);
      next(new Error("Socket authentication failed."));
    }
  });

  io.on("connection", (socket) => {
    const { restaurantId, role } = socket.data.auth;

    // The server determines room access from the verified role.
   const rooms = [];

if (["OWNER", "ADMIN", "MANAGER", "KITCHEN"].includes(role)) {
  rooms.push(`restaurant:${restaurantId}:kitchen`);
}

if (["OWNER", "ADMIN", "MANAGER", "BAR"].includes(role)) {
  rooms.push(`restaurant:${restaurantId}:bar`);
}

if (["OWNER", "ADMIN", "MANAGER", "WAITER"].includes(role)) {
  rooms.push(`restaurant:${restaurantId}:service`);
}

    socket.join(rooms);

    console.log(
      `Authenticated socket ${socket.id} joined: ${rooms.join(", ") || "no preparation rooms"}`
    );

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });
}
