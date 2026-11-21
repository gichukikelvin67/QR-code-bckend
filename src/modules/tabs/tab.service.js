
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "../../config/database.js";
import { createAuditLog } from "../audits/audit.service.js";

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertCanManageTabs(role) {
  if (!["OWNER", "ADMIN", "MANAGER"].includes(role)) {
    throw createError("You are not authorized to manage customer tabs.", 403);
  }
}

function formatMoney(value) {
  return new Prisma.Decimal(value ?? 0).toFixed(2);
}

async function findTabOrFail(tx, restaurantId, tabId) {
  const tab = await tx.customerTab.findFirst({
    where: {
      id: tabId,
      restaurantId,
    },
    include: {
      customer: true,
    },
  });

  if (!tab) {
    throw createError("Customer tab not found.", 404);
  }

  return tab;
}

async function getTabBalance(tx, tabId) {
  const result = await tx.bill.aggregate({
    where: {
      tabId,
      status: {
        in: ["OPEN", "PARTIALLY_PAID"],
      },
    },
    _sum: {
      balance: true,
    },
  });

  return new Prisma.Decimal(result._sum.balance ?? 0);
}

async function getCustomerOutstanding(tx, restaurantId, customerId) {
  const result = await tx.bill.aggregate({
    where: {
      restaurantId,
      customerId,
      status: {
        in: ["OPEN", "PARTIALLY_PAID"],
      },
    },
    _sum: {
      balance: true,
    },
  });

  return new Prisma.Decimal(result._sum.balance ?? 0);
}

function appendNote(existingNote, newNote) {
  if (!newNote) return existingNote;
  return existingNote
    ? `${existingNote}\n${newNote}`
    : newNote;
}

// Open a new customer credit tab.
export async function openCustomerTab(
  restaurantId,
  userId,
  actorRole,
  data
) {
  assertCanManageTabs(actorRole);

  return prisma.$transaction(
    async (tx) => {
      const customer = await tx.customer.findFirst({
        where: {
          id: data.customerId,
          restaurantId,
          isActive: true,
        },
      });

      if (!customer) {
        throw createError("Active customer not found.", 404);
      }

      if (!customer.allowCredit || new Prisma.Decimal(customer.creditLimit).lte(0)) {
        throw createError(
          "This customer does not have an active credit facility."
        );
      }

      const tab = await tx.customerTab.create({
        data: {
          restaurantId,
          customerId: customer.id,
          tabNumber: `TAB-${randomUUID().slice(0, 8).toUpperCase()}`,
          creditLimit: customer.creditLimit,
          notes: data.notes ?? null,
          openedBy: userId,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              creditLimit: true,
              allowCredit: true,
            },
          },
        },
      });

      await createAuditLog({
        tx,
        restaurantId,
        userId,
        action: "CUSTOMER_TAB_OPENED",
        resource: "CUSTOMER_TAB",
        resourceId: tab.id,
        description: `Opened customer tab ${tab.tabNumber}.`,
        metadata: {
          tabNumber: tab.tabNumber,
          customerId: customer.id,
          customerName: customer.name,
          creditLimit: formatMoney(tab.creditLimit),
        },
      });

      return tab;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
}

// List customer tabs with pagination and filters.
export async function listCustomerTabs(restaurantId, filters = {}) {
  const {
    status,
    customerId,
    search,
    page = 1,
    limit = 20,
  } = filters;

  const where = {
    restaurantId,
    ...(status ? { status } : {}),
    ...(customerId ? { customerId } : {}),
    ...(search
      ? {
          customer: {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                phone: {
                  contains: search,
                },
              },
            ],
          },
        }
      : {}),
  };

  const [tabs, total] = await prisma.$transaction([
    prisma.customerTab.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        _count: {
          select: {
            bills: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.customerTab.count({ where }),
  ]);

  const tabsWithBalances = await Promise.all(
    tabs.map(async (tab) => ({
      ...tab,
      outstandingBalance: formatMoney(
        await getTabBalance(prisma, tab.id)
      ),
    }))
  );

  return {
    tabs: tabsWithBalances,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Retrieve one tab and its linked bills.
export async function getCustomerTab(restaurantId, tabId) {
  const tab = await prisma.customerTab.findFirst({
    where: {
      id: tabId,
      restaurantId,
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          allowCredit: true,
          creditLimit: true,
        },
      },
      bills: {
        include: {
          payments: {
            select: {
              id: true,
              method: true,
              status: true,
              amount: true,
              reference: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!tab) {
    throw createError("Customer tab not found.", 404);
  }

  const outstandingBalance = tab.bills
    .filter((bill) => ["OPEN", "PARTIALLY_PAID"].includes(bill.status))
    .reduce(
      (total, bill) => total.plus(bill.balance),
      new Prisma.Decimal(0)
    );

  return {
    ...tab,
    outstandingBalance: formatMoney(outstandingBalance),
  };
}

// Attach an existing unpaid bill to a customer tab.
export async function attachBillToTab(
  restaurantId,
  userId,
  actorRole,
  tabId,
  billId
) {
  assertCanManageTabs(actorRole);

  return prisma.$transaction(
    async (tx) => {
      const tab = await findTabOrFail(tx, restaurantId, tabId);

      if (tab.status !== "OPEN") {
        throw createError("Only open tabs can receive bills.");
      }

      if (!tab.customer.allowCredit || !tab.customer.isActive) {
        throw createError("The customer's credit facility is inactive.");
      }

      const bill = await tx.bill.findFirst({
        where: {
          id: billId,
          restaurantId,
        },
      });

      if (!bill) {
        throw createError("Bill not found.", 404);
      }

      if (bill.customerId !== tab.customerId) {
        throw createError(
          "This bill does not belong to the customer assigned to this tab."
        );
      }

      if (bill.tabId) {
        throw createError("This bill is already assigned to a tab.");
      }

      if (!["OPEN", "PARTIALLY_PAID"].includes(bill.status)) {
        throw createError("Only unpaid or partially paid bills can be attached.");
      }

      const outstanding = await getCustomerOutstanding(
        tx,
        restaurantId,
        tab.customerId
      );

      const customerLimit = new Prisma.Decimal(tab.customer.creditLimit);
      const tabLimit = new Prisma.Decimal(tab.creditLimit);

      const effectiveLimit = Prisma.Decimal.min(
        customerLimit,
        tabLimit
      );

      if (outstanding.gt(effectiveLimit)) {
        throw createError(
          `Attaching this bill would exceed the customer's credit limit of ${formatMoney(effectiveLimit)}.`
        );
      }

      const updatedBill = await tx.bill.update({
        where: {
          id: bill.id,
        },
        data: {
          tabId: tab.id,
        },
      });

      await createAuditLog({
        tx,
        restaurantId,
        userId,
        action: "CUSTOMER_TAB_BILL_ATTACHED",
        resource: "CUSTOMER_TAB",
        resourceId: tab.id,
        description: `Attached bill ${bill.billNumber} to tab ${tab.tabNumber}.`,
        metadata: {
          tabNumber: tab.tabNumber,
          billId: bill.id,
          billNumber: bill.billNumber,
          customerId: tab.customerId,
          billBalance: formatMoney(bill.balance),
          customerOutstanding: formatMoney(outstanding),
          creditLimit: formatMoney(effectiveLimit),
        },
      });

      return updatedBill;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
}

// Close a tab only when every linked bill is settled.
export async function closeCustomerTab(
  restaurantId,
  userId,
  actorRole,
  tabId,
  data = {}
) {
  assertCanManageTabs(actorRole);

  return prisma.$transaction(
    async (tx) => {
      const tab = await findTabOrFail(tx, restaurantId, tabId);

      if (tab.status !== "OPEN") {
        throw createError("Only open tabs can be closed.");
      }

      const outstandingBalance = await getTabBalance(tx, tab.id);

      if (outstandingBalance.gt(0)) {
        throw createError(
          `This tab still has an outstanding balance of ${formatMoney(outstandingBalance)}.`
        );
      }

      const updated = await tx.customerTab.update({
        where: {
          id: tab.id,
        },
        data: {
          status: "CLOSED",
          closedBy: userId,
          closedAt: new Date(),
          notes: appendNote(tab.notes, data.notes),
        },
      });

      await createAuditLog({
        tx,
        restaurantId,
        userId,
        action: "CUSTOMER_TAB_CLOSED",
        resource: "CUSTOMER_TAB",
        resourceId: tab.id,
        description: `Closed customer tab ${tab.tabNumber}.`,
        metadata: {
          tabNumber: tab.tabNumber,
          customerId: tab.customerId,
          outstandingBalance: formatMoney(outstandingBalance),
          notes: data.notes ?? null,
        },
      });

      return updated;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
}

// Suspend an open tab.
export async function suspendCustomerTab(
  restaurantId,
  userId,
  actorRole,
  tabId,
  reason
) {
  assertCanManageTabs(actorRole);

  return prisma.$transaction(async (tx) => {
    const tab = await findTabOrFail(tx, restaurantId, tabId);

    if (tab.status !== "OPEN") {
      throw createError("Only open tabs can be suspended.");
    }

    const updated = await tx.customerTab.update({
      where: {
        id: tab.id,
      },
      data: {
        status: "SUSPENDED",
        notes: appendNote(tab.notes, `Suspended: ${reason}`),
      },
    });

    await createAuditLog({
      tx,
      restaurantId,
      userId,
      action: "CUSTOMER_TAB_SUSPENDED",
      resource: "CUSTOMER_TAB",
      resourceId: tab.id,
      description: `Suspended customer tab ${tab.tabNumber}.`,
      metadata: {
        tabNumber: tab.tabNumber,
        customerId: tab.customerId,
        reason,
      },
    });

    return updated;
  });
}

// Reactivate a suspended tab.
export async function reactivateCustomerTab(
  restaurantId,
  userId,
  actorRole,
  tabId
) {
  assertCanManageTabs(actorRole);

  return prisma.$transaction(async (tx) => {
    const tab = await findTabOrFail(tx, restaurantId, tabId);

    if (tab.status !== "SUSPENDED") {
      throw createError("Only suspended tabs can be reactivated.");
    }

    if (!tab.customer.isActive || !tab.customer.allowCredit) {
      throw createError(
        "The customer's account or credit facility is inactive."
      );
    }

    const updated = await tx.customerTab.update({
      where: {
        id: tab.id,
      },
      data: {
        status: "OPEN",
      },
    });

    await createAuditLog({
      tx,
      restaurantId,
      userId,
      action: "CUSTOMER_TAB_REACTIVATED",
      resource: "CUSTOMER_TAB",
      resourceId: tab.id,
      description: `Reactivated customer tab ${tab.tabNumber}.`,
      metadata: {
        tabNumber: tab.tabNumber,
        customerId: tab.customerId,
      },
    });

    return updated;
  });
}
