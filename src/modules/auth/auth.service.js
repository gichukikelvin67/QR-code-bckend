import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

import prisma from "../../config/database.js";
import {env}from "../../config/env.js";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_DAYS = 7;

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateAccessToken(user, membership) {
  return jwt.sign(
    {
      restaurantId: membership.restaurantId,
      membershipId: membership.id,
      role: membership.role,
    },
    env.JWT_ACCESS_SECRET,
    {
      subject: user.id,
      expiresIn: ACCESS_TOKEN_EXPIRY,
    }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

function getRefreshExpiry() {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REFRESH_TOKEN_DAYS);
  return expiry;
}

// Create a restaurant owner and their restaurant.
export async function registerOwner(data) {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw createError("An account with this email already exists.", 409);
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const restaurantSlug =
    data.restaurantName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    crypto.randomBytes(3).toString("hex");

  const refreshToken = generateRefreshToken();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
        },
      });

      const restaurant = await tx.restaurant.create({
        data: {
          name: data.restaurantName,
          slug: restaurantSlug,
        },
      });

      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          restaurantId: restaurant.id,
          role: "OWNER",
        },
      });

      await tx.refreshSession.create({
        data: {
          userId: user.id,
          restaurantId: restaurant.id,
          tokenHash: hashRefreshToken(refreshToken),
          expiresAt: getRefreshExpiry(),
        },
      });

      return { user, restaurant, membership };
    });

    const accessToken = generateAccessToken(
      result.user,
      result.membership
    );

    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
      },
      restaurant: {
        id: result.restaurant.id,
        name: result.restaurant.name,
        slug: result.restaurant.slug,
      },
      accessToken,
      refreshToken,
    };
  } catch (error) {
    if (error.code === "P2002") {
      throw createError("An account or restaurant with these details already exists.", 409);
    }

    throw error;
  }
}

// Authenticate a user within a specific restaurant.
export async function login(data) {
  const user = await prisma.user.findUnique({
    where: {
      email: data.email,
    },
    include: {
      memberships: {
        where: {
          isActive: true,
          restaurant: {
            slug: data.restaurantSlug,
            isActive: true,
          },
        },
        include: {
          restaurant: true,
        },
      },
    },
  });

  if (!user || !user.isActive) {
    throw createError("Invalid email, password or restaurant.", 401);
  }

  const passwordMatches = await bcrypt.compare(
    data.password,
    user.passwordHash
  );

  if (!passwordMatches || user.memberships.length === 0) {
    throw createError("Invalid email, password or restaurant.", 401);
  }

  const membership = user.memberships[0];
  const refreshToken = generateRefreshToken();

  await prisma.refreshSession.create({
    data: {
      userId: user.id,
      restaurantId: membership.restaurantId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: getRefreshExpiry(),
    },
  });

  const accessToken = generateAccessToken(user, membership);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    restaurant: {
      id: membership.restaurant.id,
      name: membership.restaurant.name,
      slug: membership.restaurant.slug,
    },
    role: membership.role,
    accessToken,
    refreshToken,
  };
}

export async function refreshSession(rawToken) {
  if (!rawToken) {
    throw createError("Refresh token is required.", 401);
  }

  const tokenHash = hashRefreshToken(rawToken);
  const now = new Date();

  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          memberships: {
            where: {
              isActive: true,
            },
            include: {
              restaurant: true,
            },
          },
        },
      },
    },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= now ||
    !session.user.isActive
  ) {
    throw createError("Invalid or expired refresh session.", 401);
  }

  const membership = session.user.memberships.find(
    (item) =>
      item.restaurantId === session.restaurantId &&
      item.restaurant.isActive
  );

  if (!membership) {
    throw createError("Restaurant access is no longer active.", 403);
  }

  const newRefreshToken = generateRefreshToken();

  const rotated = await prisma.$transaction(async (tx) => {
    const revokeResult = await tx.refreshSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        revokedAt: now,
      },
    });

    if (revokeResult.count !== 1) {
      throw createError("Refresh session has already been used.", 401);
    }

    await tx.refreshSession.create({
      data: {
        userId: session.userId,
        restaurantId: session.restaurantId,
        tokenHash: hashRefreshToken(newRefreshToken),
        expiresAt: getRefreshExpiry(),
      },
    });

    return true;
  });

  if (!rotated) {
    throw createError("Unable to refresh session.", 401);
  }

  return {
    accessToken: generateAccessToken(session.user, membership),
    refreshToken: newRefreshToken,
  };
}

export async function logout(rawToken) {
  if (!rawToken) return;

  await prisma.refreshSession.updateMany({
    where: {
      tokenHash: hashRefreshToken(rawToken),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}
