
import prisma from "../../config/database.js";

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "secret",
  "passkey",
  "consumersecret",
  "consumerkey",
]);

function sanitizeMetadata(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeMetadata);
  }

  if (typeof value === "object") {
    const sanitized = {};

    for (const [key, entry] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizeMetadata(entry);
      }
    }

    return sanitized;
  }

  if (typeof value === "string") {
    return value.length > 2000
      ? `${value.slice(0, 2000)}...[TRUNCATED]`
      : value;
  }

  return value;
}

export async function createAuditLog({
  tx = prisma,
  restaurantId,
  userId = null,
  action,
  resource,
  resourceId = null,
  description = null,
  metadata = null,
  ipAddress = null,
  userAgent = null,
}) {
  if (!restaurantId || !action || !resource) {
    throw new Error(
      "restaurantId, action and resource are required for audit logging."
    );
  }

  return tx.auditLog.create({
    data: {
      restaurantId,
      userId,
      action,
      resource,
      resourceId,
      description,
      metadata: metadata
        ? sanitizeMetadata(metadata)
        : undefined,
      ipAddress,
      userAgent,
    },
  });
}

export async function listAuditLogs({
  restaurantId,
  page = 1,
  limit = 50,
  action,
  resource,
  userId,
  from,
  to,
}) {
  const where = {
    restaurantId,
    ...(action ? { action } : {}),
    ...(resource ? { resource } : {}),
    ...(userId ? { userId } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    }),

    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
