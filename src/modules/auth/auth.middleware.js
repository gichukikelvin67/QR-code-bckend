
import jwt from "jsonwebtoken";
import prisma from "../../config/database.js";
import { env } from "../../config/env.js";

export async function authenticate(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const token = authorization.slice(7);

    let payload;

    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token.",
      });
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
      include: {
        user: true,
        restaurant: true,
      },
    });

    if (!membership) {
      return res.status(401).json({
        success: false,
        message: "Your account or restaurant access is inactive.",
      });
    }

    req.auth = {
      userId: membership.userId,
      restaurantId: membership.restaurantId,
      membershipId: membership.id,
      role: membership.role,
      email: membership.user.email,
      name: membership.user.name,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }

    next();
  };
}
