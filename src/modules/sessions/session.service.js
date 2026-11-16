
import prisma from "../../config/database.js";

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function openDiningSession(restaurantId, tableId) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const table = await tx.restaurantTable.findFirst({
          where: {
            id: tableId,
            restaurantId,
          },
        });

        if (!table) {
          throw createError("Table not found.", 404);
        }

        if (
          table.status !== "AVAILABLE" &&
          table.status !== "RESERVED"
        ) {
          throw createError(
            "This table is not available for a new session.",
            409
          );
        }

        const existingSession = await tx.diningSession.findFirst({
          where: {
            tableId,
            status: "OPEN",
          },
        });

        if (existingSession) {
          throw createError(
            "This table already has an open dining session.",
            409
          );
        }

        // Compare-and-set prevents another request from changing
        // the table status between our read and update.
        const updatedTable = await tx.restaurantTable.updateMany({
          where: {
            id: tableId,
            restaurantId,
            status: table.status,
          },
          data: {
            status: "OCCUPIED",
          },
        });

        if (updatedTable.count !== 1) {
          throw createError(
            "The table status changed. Please try again.",
            409
          );
        }

        return tx.diningSession.create({
          data: {
            tableId,
          },
          include: {
            table: {
              select: {
                id: true,
                tableNumber: true,
                capacity: true,
                status: true,
              },
            },
          },
        });
      },
      {
        isolationLevel: "Serializable",
      }
    );
  } catch (error) {
    if (error.code === "P2034") {
      throw createError(
        "A conflicting table operation occurred. Please try again.",
        409
      );
    }

    throw error;
  }
}

export async function getDiningSessions(restaurantId) {
  return prisma.diningSession.findMany({
    where: {
      table: {
        restaurantId,
      },
    },
    orderBy: {
      startedAt: "desc",
    },
    include: {
      table: {
        select: {
          id: true,
          tableNumber: true,
          capacity: true,
          status: true,
        },
      },
    },
  });
}

export async function getDiningSessionById(restaurantId, sessionId) {
  const session = await prisma.diningSession.findFirst({
    where: {
      id: sessionId,
      table: {
        restaurantId,
      },
    },
    include: {
      table: {
        select: {
          id: true,
          tableNumber: true,
          capacity: true,
          status: true,
        },
      },
    },
  });

  if (!session) {
    throw createError("Dining session not found.", 404);
  }

  return session;
}

export async function closeDiningSession(restaurantId, sessionId) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.diningSession.findFirst({
      where: {
        id: sessionId,
        status: "OPEN",
        table: {
          restaurantId,
        },
      },
      include: {
        table: true,
      },
    });

    if (!session) {
      throw createError(
        "Open dining session not found.",
        404
      );
    }

    const closedSession = await tx.diningSession.update({
      where: {
        id: sessionId,
      },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
      },
      include: {
        table: {
          select: {
            id: true,
            tableNumber: true,
            capacity: true,
          },
        },
      },
    });

    await tx.restaurantTable.update({
      where: {
        id: session.tableId,
      },
      data: {
        status: "AVAILABLE",
      },
    });

    return {
      ...closedSession,
      table: {
        ...closedSession.table,
        status: "AVAILABLE",
      },
    };
  });
}
