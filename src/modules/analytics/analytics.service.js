
import prisma from "../../config/database.js";
import { Prisma } from "@prisma/client";

const ZERO = new Prisma.Decimal(0);

function getDateRange(from, to) {
  if (!from && !to) return {};

  const createdAt = {};

  if (from) {
    createdAt.gte = new Date(`${from}T00:00:00.000Z`);
  }

  if (to) {
    const endDate = new Date(`${to}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    createdAt.lt = endDate;
  }

  return { createdAt };
}

function sumDecimals(records, field) {
  return records.reduce(
    (total, record) => total.plus(record[field] ?? ZERO),
    ZERO
  );
}

function money(value) {
  return Number(value.toFixed(2));
}

export async function getAnalyticsOverview({
  restaurantId,
  from,
  to,
}) {
  const dateRange = getDateRange(from, to);

  const paymentDateRange = from || to
    ? {
        verifiedAt: {
          ...(from
            ? { gte: new Date(`${from}T00:00:00.000Z`) }
            : {}),
          ...(to
            ? {
                lt: (() => {
                  const date = new Date(`${to}T00:00:00.000Z`);
                  date.setUTCDate(date.getUTCDate() + 1);
                  return date;
                })(),
              }
            : {}),
        },
      }
    : {};

  const refundDateRange = from || to
    ? {
        processedAt: {
          ...(from
            ? { gte: new Date(`${from}T00:00:00.000Z`) }
            : {}),
          ...(to
            ? {
                lt: (() => {
                  const date = new Date(`${to}T00:00:00.000Z`);
                  date.setUTCDate(date.getUTCDate() + 1);
                  return date;
                })(),
              }
            : {}),
        },
      }
    : {};

  const [
    payments,
    refunds,
    orderStats,
    outstandingBills,
    ordersCount,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: {
        restaurantId,
        status: "COMPLETED",
        verifiedAt: { not: null },
        ...paymentDateRange,
      },
      select: {
        amount: true,
        method: true,
      },
    }),

    prisma.refund.findMany({
      where: {
        restaurantId,
        status: "COMPLETED",
        ...refundDateRange,
      },
      select: {
        amount: true,
      },
    }),

    prisma.order.aggregate({
      where: {
        restaurantId,
        status: { not: "CANCELLED" },
        ...dateRange,
      },
      _sum: {
        total: true,
      },
      _count: {
        _all: true,
      },
    }),

    prisma.bill.aggregate({
      where: {
        restaurantId,
        status: {
          in: ["OPEN", "PARTIALLY_PAID"],
        },
        ...dateRange,
      },
      _sum: {
        balance: true,
      },
    }),

    prisma.order.count({
      where: {
        restaurantId,
        ...dateRange,
      },
    }),
  ]);

  const grossPayments = sumDecimals(payments, "amount");
  const completedRefunds = sumDecimals(refunds, "amount");
  const netRevenue = grossPayments.minus(completedRefunds);

  const orderTotal = orderStats._sum.total ?? ZERO;
  const completedOrderCount = orderStats._count._all;

  const averageOrderValue =
    completedOrderCount > 0
      ? orderTotal.div(completedOrderCount)
      : ZERO;

  const paymentBreakdown = Object.values(
    payments.reduce((result, payment) => {
      const method = payment.method;

      if (!result[method]) {
        result[method] = {
          method,
          transactionCount: 0,
          amount: ZERO,
        };
      }

      result[method].transactionCount += 1;
      result[method].amount = result[method].amount.plus(
        payment.amount
      );

      return result;
    }, {})
  ).map((entry) => ({
    method: entry.method,
    transactionCount: entry.transactionCount,
    amount: money(entry.amount),
  }));

  return {
    period: {
      from: from ?? null,
      to: to ?? null,
    },

    revenue: {
      grossPayments: money(grossPayments),
      completedRefunds: money(completedRefunds),
      netRevenue: money(netRevenue),
    },

    orders: {
      total: ordersCount,
      nonCancelled: completedOrderCount,
      averageOrderValue: money(averageOrderValue),
    },

    outstanding: {
      billBalance: money(
        outstandingBills._sum.balance ?? ZERO
      ),
    },

    paymentBreakdown,
  };
}

export async function getSalesTrends({
  restaurantId,
  from,
  to,
}) {
  const today = new Date();
  const endDate = to
    ? new Date(`${to}T00:00:00.000Z`)
    : new Date(Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate()
      ));

  const startDate = from
    ? new Date(`${from}T00:00:00.000Z`)
    : new Date(endDate);

  if (!from) {
    startDate.setUTCDate(startDate.getUTCDate() - 6);
  }

  const exclusiveEndDate = new Date(endDate);
  exclusiveEndDate.setUTCDate(exclusiveEndDate.getUTCDate() + 1);

  if (startDate > endDate) {
    throw new Error("The start date cannot be after the end date.");
  }

  const [payments, refunds, orders] = await Promise.all([
    prisma.payment.findMany({
      where: {
        restaurantId,
        status: "COMPLETED",
        verifiedAt: {
          gte: startDate,
          lt: exclusiveEndDate,
        },
      },
      select: {
        amount: true,
        verifiedAt: true,
      },
    }),

    prisma.refund.findMany({
      where: {
        restaurantId,
        status: "COMPLETED",
        processedAt: {
          gte: startDate,
          lt: exclusiveEndDate,
        },
      },
      select: {
        amount: true,
        processedAt: true,
      },
    }),

    prisma.order.findMany({
      where: {
        restaurantId,
        status: { not: "CANCELLED" },
        createdAt: {
          gte: startDate,
          lt: exclusiveEndDate,
        },
      },
      select: {
        createdAt: true,
      },
    }),
  ]);

  const daily = new Map();

  for (
    let date = new Date(startDate);
    date <= endDate;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const key = date.toISOString().slice(0, 10);

    daily.set(key, {
      date: key,
      grossPayments: ZERO,
      refunds: ZERO,
      netRevenue: ZERO,
      orders: 0,
    });
  }

  for (const payment of payments) {
    const key = payment.verifiedAt.toISOString().slice(0, 10);
    const entry = daily.get(key);

    if (entry) {
      entry.grossPayments = entry.grossPayments.plus(payment.amount);
    }
  }

  for (const refund of refunds) {
    if (!refund.processedAt) continue;

    const key = refund.processedAt.toISOString().slice(0, 10);
    const entry = daily.get(key);

    if (entry) {
      entry.refunds = entry.refunds.plus(refund.amount);
    }
  }

  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const entry = daily.get(key);

    if (entry) {
      entry.orders += 1;
    }
  }

  const trends = Array.from(daily.values()).map((entry) => {
    const netRevenue = entry.grossPayments.minus(entry.refunds);

    return {
      date: entry.date,
      grossPayments: money(entry.grossPayments),
      refunds: money(entry.refunds),
      netRevenue: money(netRevenue),
      orders: entry.orders,
    };
  });

  return {
    period: {
      from: startDate.toISOString().slice(0, 10),
      to: endDate.toISOString().slice(0, 10),
    },
    trends,
  };
}


export async function getPaymentMethodsReport({
  restaurantId,
  from,
  to,
}) {
  const dateRange = from || to
    ? {
        verifiedAt: {
          ...(from
            ? { gte: new Date(`${from}T00:00:00.000Z`) }
            : {}),
          ...(to
            ? {
                lt: (() => {
                  const date = new Date(`${to}T00:00:00.000Z`);
                  date.setUTCDate(date.getUTCDate() + 1);
                  return date;
                })(),
              }
            : {}),
        },
      }
    : {};

  const payments = await prisma.payment.findMany({
    where: {
      restaurantId,
      status: "COMPLETED",
      verifiedAt: { not: null },
      ...dateRange,
    },
    select: {
      method: true,
      amount: true,
    },
  });

  const report = {};

  for (const payment of payments) {
    if (!report[payment.method]) {
      report[payment.method] = {
        method: payment.method,
        transactionCount: 0,
        totalAmount: ZERO,
      };
    }

    report[payment.method].transactionCount += 1;
    report[payment.method].totalAmount =
      report[payment.method].totalAmount.plus(payment.amount);
  }

  const grossTotal = sumDecimals(payments, "amount");

  const methods = Object.values(report).map((entry) => {
    const percentage = grossTotal.gt(0)
      ? entry.totalAmount
          .div(grossTotal)
          .mul(100)
      : ZERO;

    return {
      method: entry.method,
      transactionCount: entry.transactionCount,
      totalAmount: money(entry.totalAmount),
      percentage: Number(percentage.toFixed(2)),
    };
  });

  return {
    period: {
      from: from ?? null,
      to: to ?? null,
    },
    totalTransactions: payments.length,
    grossPayments: money(grossTotal),
    methods,
  };
}


export async function getTopSellingItems({
  restaurantId,
  from,
  to,
  limit = 10,
}) {
  const dateRange = getDateRange(from, to);

  const items = await prisma.orderItem.groupBy({
    by: ["menuItemId", "itemName"],
    where: {
      order: {
        restaurantId,
        status: { not: "CANCELLED" },
        ...dateRange,
      },
    },
    _sum: {
      quantity: true,
      lineTotal: true,
    },
    _count: {
      _all: true,
    },
    orderBy: {
      _sum: {
        quantity: "desc",
      },
    },
    take: limit,
  });

  return {
    period: {
      from: from ?? null,
      to: to ?? null,
    },
    items: items.map((item) => ({
      menuItemId: item.menuItemId,
      itemName: item.itemName,
      quantitySold: item._sum.quantity ?? 0,
      salesValue: money(item._sum.lineTotal ?? ZERO),
      orderLines: item._count._all,
    })),
  };
}


export async function getOrderPerformance({
  restaurantId,
  from,
  to,
}) {
  const dateRange = getDateRange(from, to);

  const groupedOrders = await prisma.order.groupBy({
    by: ["status"],
    where: {
      restaurantId,
      ...dateRange,
    },
    _count: {
      _all: true,
    },
    _sum: {
      total: true,
    },
  });

  const statuses = [
    "PENDING",
    "ACCEPTED",
    "PREPARING",
    "READY",
    "SERVED",
    "CANCELLED",
  ];

  const breakdown = statuses.map((status) => {
    const record = groupedOrders.find(
      (order) => order.status === status
    );

    return {
      status,
      count: record?._count._all ?? 0,
      orderValue: money(record?._sum.total ?? ZERO),
    };
  });

  const totalOrders = breakdown.reduce(
    (total, item) => total + item.count,
    0
  );

  const servedOrders =
    breakdown.find((item) => item.status === "SERVED")?.count ?? 0;

  const cancelledOrders =
    breakdown.find((item) => item.status === "CANCELLED")?.count ?? 0;

  const completionRate = totalOrders > 0
    ? (servedOrders / totalOrders) * 100
    : 0;

  return {
    period: {
      from: from ?? null,
      to: to ?? null,
    },
    totalOrders,
    servedOrders,
    cancelledOrders,
    completionRate: Number(completionRate.toFixed(2)),
    breakdown,
  };
}

export async function getInventoryInsights({
  restaurantId,
  from,
  to,
}) {
  const dateRange = getDateRange(from, to);

  const [items, movements] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: {
        restaurantId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        unit: true,
        currentStock: true,
        reorderLevel: true,
        costPerUnit: true,
      },
    }),

    prisma.stockMovement.groupBy({
      by: ["type"],
      where: {
        restaurantId,
        ...dateRange,
      },
      _sum: {
        quantity: true,
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const movementTypes = [
    "RECEIPT",
    "ADJUSTMENT_IN",
    "ADJUSTMENT_OUT",
    "RECIPE_DEDUCTION",
    "WASTE",
    "RETURN",
  ];

  const movementBreakdown = movementTypes.map((type) => {
    const movement = movements.find(
      (entry) => entry.type === type
    );

    return {
      type,
      transactions: movement?._count._all ?? 0,
      quantity: Number(
        (movement?._sum.quantity ?? ZERO).toFixed(3)
      ),
    };
  });

  const lowStockItems = items.filter((item) =>
    item.currentStock.lte(item.reorderLevel)
  );

  const outOfStockItems = items.filter((item) =>
    item.currentStock.lte(0)
  );

  const inventoryValue = items.reduce(
    (total, item) =>
      total.plus(item.currentStock.mul(item.costPerUnit)),
    ZERO
  );

  return {
    period: {
      from: from ?? null,
      to: to ?? null,
    },

    summary: {
      totalActiveItems: items.length,
      lowStockItems: lowStockItems.length,
      outOfStockItems: outOfStockItems.length,
      estimatedInventoryValue: money(inventoryValue),
    },

    movements: movementBreakdown,

    lowStock: lowStockItems.map((item) => ({
      id: item.id,
      name: item.name,
      currentStock: Number(item.currentStock.toFixed(3)),
      reorderLevel: Number(item.reorderLevel.toFixed(3)),
      unit: item.unit,
    })),
  };
}

export async function getStaffPerformance({
  restaurantId,
  from,
  to,
}) {
  const dateRange = getDateRange(from, to);

  const history = await prisma.orderStatusHistory.findMany({
    where: {
      restaurantId,
      ...dateRange,
    },
    select: {
      performedBy: true,
      toStatus: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const staffMap = new Map();

  for (const record of history) {
    const userId = record.performedBy;

    if (!staffMap.has(userId)) {
      staffMap.set(userId, {
        userId,
        name: record.user.name,
        email: record.user.email,
        ordersAccepted: 0,
        ordersPrepared: 0,
        ordersReady: 0,
        ordersServed: 0,
        ordersCancelled: 0,
        totalActions: 0,
      });
    }

    const staff = staffMap.get(userId);

    staff.totalActions += 1;

    switch (record.toStatus) {
      case "ACCEPTED":
        staff.ordersAccepted += 1;
        break;
      case "PREPARING":
        staff.ordersPrepared += 1;
        break;
      case "READY":
        staff.ordersReady += 1;
        break;
      case "SERVED":
        staff.ordersServed += 1;
        break;
      case "CANCELLED":
        staff.ordersCancelled += 1;
        break;
    }
  }

  return {
    period: {
      from: from ?? null,
      to: to ?? null,
    },
    totalStaff: staffMap.size,
    staff: Array.from(staffMap.values()).sort(
      (a, b) => b.totalActions - a.totalActions
    ),
  };
}
