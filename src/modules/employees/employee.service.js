
import prisma from "../../config/database.js";
import { createAuditLog } from "../audits/audit.service.js";

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertCanManageEmployees(role) {
  if (!["OWNER", "ADMIN"].includes(role)) {
    throw createError(
      "You are not authorized to manage employees.",
      403
    );
  }
}

function assertCanAssignRole(actorRole, targetRole) {
  if (targetRole === "OWNER") {
    throw createError(
      "The OWNER role cannot be assigned through employee management."
    );
  }

  if (actorRole === "ADMIN" && targetRole === "ADMIN") {
    throw createError(
      "Administrators cannot assign the ADMIN role.",
      403
    );
  }
}

async function findEmployeeOrFail(tx, restaurantId, employeeId) {
  const membership = await tx.membership.findFirst({
    where: {
      id: employeeId,
      restaurantId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
        },
      },
    },
  });

  if (!membership) {
    throw createError("Employee not found.", 404);
  }

  return membership;
}

export async function addEmployee(
  restaurantId,
  userId,
  actorRole,
  data
) {
  assertCanManageEmployees(actorRole);

  assertCanAssignRole(actorRole, data.role);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: {
        email: data.email.toLowerCase(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    if (!user) {
      throw createError(
        "No registered user exists with that email. The employee must create an account first.",
        404
      );
    }

    if (!user.isActive) {
      throw createError(
        "This user account is inactive. Activate the account before adding the employee."
      );
    }

    const existingMembership = await tx.membership.findUnique({
      where: {
        userId_restaurantId: {
          userId: user.id,
          restaurantId,
        },
      },
    });

    if (existingMembership) {
      throw createError(
        "This user is already associated with your restaurant.",
        409
      );
    }

    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        restaurantId,
        role: data.role,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    await createAuditLog({
      tx,
      restaurantId,
      userId,
      action: "EMPLOYEE_ADDED",
      resource: "EMPLOYEE",
      resourceId: membership.id,
      description: `Added ${user.email} as ${data.role}.`,
      metadata: {
        employeeUserId: user.id,
        employeeEmail: user.email,
        assignedRole: data.role,
      },
    });

    return membership;
  });
}

export async function listEmployees(restaurantId, filters = {}) {
  const {
    search,
    role,
    isActive,
    page = 1,
    limit = 20,
  } = filters;

  const where = {
    restaurantId,

    ...(role ? { role } : {}),

    ...(isActive !== undefined
      ? { isActive: isActive === "true" }
      : {}),

    ...(search
      ? {
          user: {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          },
        }
      : {}),
  };

  const [employees, total] = await prisma.$transaction([
    prisma.membership.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    }),

    prisma.membership.count({ where }),
  ]);

  return {
    employees,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getEmployee(restaurantId, employeeId) {
  return findEmployeeOrFail(prisma, restaurantId, employeeId);
}

export async function updateEmployeeRole(
  restaurantId,
  userId,
  actorRole,
  employeeId,
  data
) {
  assertCanManageEmployees(actorRole);

  assertCanAssignRole(actorRole, data.role);

  return prisma.$transaction(async (tx) => {
    const employee = await findEmployeeOrFail(
      tx,
      restaurantId,
      employeeId
    );

    if (employee.role === "OWNER") {
      throw createError(
        "An owner's role cannot be changed through employee management.",
        403
      );
    }

    if (employee.role === data.role) {
      return employee;
    }

    const updated = await tx.membership.update({
      where: {
        id: employeeId,
      },
      data: {
        role: data.role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    await createAuditLog({
      tx,
      restaurantId,
      userId,
      action: "EMPLOYEE_ROLE_UPDATED",
      resource: "EMPLOYEE",
      resourceId: employeeId,
      description: `Changed employee role from ${employee.role} to ${data.role}.`,
      metadata: {
        employeeUserId: employee.userId,
        previousRole: employee.role,
        newRole: data.role,
      },
    });

    return updated;
  });
}

export async function updateEmployeeStatus(
  restaurantId,
  userId,
  actorRole,
  employeeId,
  isActive
) {
  assertCanManageEmployees(actorRole);

  return prisma.$transaction(async (tx) => {
    const employee = await findEmployeeOrFail(
      tx,
      restaurantId,
      employeeId
    );

    if (employee.role === "OWNER") {
      throw createError(
        "An owner's membership cannot be changed through employee management.",
        403
      );
    }

    if (employee.userId === userId && !isActive) {
      throw createError(
        "You cannot deactivate your own restaurant membership."
      );
    }

    if (employee.isActive === isActive) {
      return employee;
    }

    const updated = await tx.membership.update({
      where: {
        id: employeeId,
      },
      data: {
        isActive,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    await createAuditLog({
      tx,
      restaurantId,
      userId,
      action: isActive
        ? "EMPLOYEE_ACTIVATED"
        : "EMPLOYEE_DEACTIVATED",
      resource: "EMPLOYEE",
      resourceId: employeeId,
      description: isActive
        ? "Employee membership activated."
        : "Employee membership deactivated.",
      metadata: {
        employeeUserId: employee.userId,
        employeeEmail: employee.user.email,
        role: employee.role,
        previousStatus: employee.isActive,
        newStatus: isActive,
      },
    });

    return updated;
  });
}
