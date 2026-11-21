
import prisma from "../../config/database.js";
import { Prisma } from "@prisma/client";

const ZERO = new Prisma.Decimal(0);
const REPORT_TIME_ZONE = "Africa/Nairobi";
const DEFAULT_TOP_ITEMS_LIMIT = 10;
const MAX_TOP_ITEMS_LIMIT = 100;

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getNairobiDateString(date = new Date()) {
  const parts = dateFormatter.formatToParts(date);
  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

function addCalendarDays(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

// Kenya uses UTC+3 throughout the year.
function getNairobiDayStart(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day) - 3 * 60 * 60 * 1000
  );
}

function getDateRange(from, to, field = "createdAt") {
  if (!from && !to) return {};

  const range = {};

  if (from) {
    range.gte = getNairobiDayStart(from);
  }

  if (to) {
    range.lt = getNairobiDayStart(
      addCalendarDays(to, 1)
    );
  }

  return {
    [field]: range,
  };
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

function quantity(value) {
  return Number(value.toFixed(3));
}

function getPeriod(from, to) {
  return {
    from: from ?? null,
    to: to ?? null,
    timeZone: REPORT_TIME_ZONE,
  };
}

function getTrendDateRange(from, to) {
  const today = getNairobiDateString();

  const endDate = to ?? today;

  const startDate = from
    ?? (to ? endDate : addCalendarDays(today, -6));

  if (startDate > endDate) {
    throw Object.assign(
      new Error("The start date cannot be after the end date."),
      { statusCode: 400 }
    );
  }

  return {
    startDate,
    endDate,
    start: getNairobiDayStart(startDate),
    endExclusive: getNairobiDayStart(
      addCalendarDays(endDate, 1)
    ),
  };
}

export async function getAnalyticsOverview({
  restaurantId,
  from,
  to,
}) {
  const orderDateRange = getDateRange(from, to);
  const paymentDateRange = getDateRange(
    from,
    to,
    "verifiedAt"
  );
  const refundDateRange = getDateRange(
    from,
    to,
    "processedAt"
  );

  const [
    payments,
    refunds,
    orderStats,
    servedOrderStats,
    totalOrders,
    currentOutstanding,
    periodOutstanding,
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
        processedAt: { not: null },
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
        ...orderDateRange,
      },
      _sum: {
        total: true,
      },
      _count: {
        _all: true,
      },
    }),

    prisma.order.aggregate({
      where: {
        restaurantId,
        status: "SERVED",
        ...orderDateRange,
      },
      _sum: {
        total: true,
      },
      _count: {
        _all: true,
      },
    }),

    prisma.order.count({
      where: {
        restaurantId,
        ...orderDateRange,
      },
    }),

    prisma.bill.aggregate({
      where: {
        restaurantId,
        status: {
          in: ["OPEN", "PARTIALLY_PAID"],
        },
      },
      _sum: {
        balance: true,
      },
    }),

    prisma.bill.aggregate({
      where: {
        restaurantId,
        status: {
          in: ["OPEN", "PARTIALLY_PAID"],
        },
        ...getDateRange(from, to),
      },
      _sum: {
        balance: true,
      },
    }),
  ]);

  const grossPayments = sumDecimals(payments, "amount");
  const completedRefunds = sumDecimals(refunds, "amount");
  const netRevenue = grossPayments.minus(completedRefunds);

  const nonCancelledOrderCount =
    orderStats._count._all;

  const servedOrderCount =
    servedOrderStats._count._all;

  const servedOrderValue =
    servedOrderStats._sum.total ?? ZERO;

  const averageOrderValue = servedOrderCount > 0
    ? servedOrderValue.div(servedOrderCount)
    : ZERO;

  const paymentMap = new Map();

  for (const payment of payments) {
    if (!paymentMap.has(payment.method)) {
      paymentMap.set(payment.method, {
        method: payment.method,
        transactionCount: 0,
        amount: ZERO,
      });
    }

    const entry = paymentMap.get(payment.method);

    entry.transactionCount += 1;
    entry.amount = entry.amount.plus(payment.amount);
  }

  const paymentBreakdown = Array.from(
    paymentMap.values()
  ).map((entry) => ({
    method: entry.method,
    transactionCount: entry.transactionCount,
    amount: money(entry.amount),
  }));

  return {
    period: getPeriod(from, to),

    revenue: {
      grossPayments: money(grossPayments),
      completedRefunds: money(completedRefunds),
      netRevenue: money(netRevenue),
    },

    orders: {
      total: totalOrders,
      nonCancelled: nonCancelledOrderCount,
      served: servedOrderCount,
      averageOrderValue: money(averageOrderValue),
    },

    outstanding: {
      currentBalance: money(
        currentOutstanding._sum.balance ?? ZERO
      ),
      periodCreatedBalance: money(
        periodOutstanding._sum.balance ?? ZERO
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
  const {
    startDate,
    endDate,
    start,
    endExclusive,
  } = getTrendDateRange(from, to);

  const [payments, refunds, orders] = await Promise.all([
    prisma.payment.findMany({
      where: {
        restaurantId,
        status: "COMPLETED",
        verifiedAt: {
          gte: start,
          lt: endExclusive,
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
          gte: start,
          lt: endExclusive,
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
          gte: start,
          lt: endExclusive,
        },
      },
      select: {
        createdAt: true,
      },
    }),
  ]);

  const daily = new Map();

  for (
    let date = startDate;
    date <= endDate;
    date = addCalendarDays(date, 1)
  ) {
    daily.set(date, {
      date,
      grossPayments: ZERO,
      refunds: ZERO,
      orders: 0,
    });
  }

  for (const payment of payments) {
    if (!payment.verifiedAt) continue;

    const key = getNairobiDateString(payment.verifiedAt);
    const entry = daily.get(key);

    if (entry) {
      entry.grossPayments = entry.grossPayments.plus(
        payment.amount
      );
    }
  }

  for (const refund of refunds) {
    if (!refund.processedAt) continue;

    const key = getNairobiDateString(refund.processedAt);
    const entry = daily.get(key);

    if (entry) {
      entry.refunds = entry.refunds.plus(refund.amount);
    }
  }

  for (const order of orders) {
    const key = getNairobiDateString(order.createdAt);
    const entry = daily.get(key);

    if (entry) {
      entry.orders += 1;
    }
  }

  const trends = Array.from(daily.values()).map((entry) => ({
    date: entry.date,
    grossPayments: money(entry.grossPayments),
    refunds: money(entry.refunds),
    netRevenue: money(
      entry.grossPayments.minus(entry.refunds)
    ),
    orders: entry.orders,
  }));

  return {
    period: getPeriod(startDate, endDate),
    trends,
  };
}

export async function getPaymentMethodsReport({
  restaurantId,
  from,
  to,
}) {
  const payments = await prisma.payment.findMany({
    where: {
      restaurantId,
      status: "COMPLETED",
      verifiedAt: { not: null },
      ...getDateRange(from, to, "verifiedAt"),
    },
    select: {
      method: true,
      amount: true,
    },
  });

  const report = new Map();

  for (const payment of payments) {
    if (!report.has(payment.method)) {
      report.set(payment.method, {
        method: payment.method,
        transactionCount: 0,
        totalAmount: ZERO,
      });
    }

    const entry = report.get(payment.method);

    entry.transactionCount += 1;
    entry.totalAmount = entry.totalAmount.plus(
      payment.amount
    );
  }

  const grossTotal = sumDecimals(payments, "amount");

  const methods = Array.from(report.values()).map((entry) => {
    const percentage = grossTotal.gt(0)
      ? entry.totalAmount.div(grossTotal).mul(100)
      : ZERO;

    return {
      method: entry.method,
      transactionCount: entry.transactionCount,
      totalAmount: money(entry.totalAmount),
      percentage: Number(percentage.toFixed(2)),
    };
  });

  return {
    period: getPeriod(from, to),
    totalTransactions: payments.length,
    grossPayments: money(grossTotal),
    methods,
  };
}

export async function getTopSellingItems({
  restaurantId,
  from,
  to,
  limit = DEFAULT_TOP_ITEMS_LIMIT,
}) {
  const safeLimit = Math.min(
    MAX_TOP_ITEMS_LIMIT,
    Math.max(1, Math.trunc(Number(limit) || DEFAULT_TOP_ITEMS_LIMIT))
  );

  const items = await prisma.orderItem.groupBy({
    by: ["menuItemId", "itemName"],
    where: {
      order: {
        restaurantId,
        status: { not: "CANCELLED" },
        ...getDateRange(from, to),
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
    take: safeLimit,
  });

  return {
    period: getPeriod(from, to),
    limit: safeLimit,
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
  const groupedOrders = await prisma.order.groupBy({
    by: ["status"],
    where: {
      restaurantId,
      ...getDateRange(from, to),
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
    period: getPeriod(from, to),
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
        ...getDateRange(from, to),
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
      quantity: quantity(
        movement?._sum.quantity ?? ZERO
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
    period: getPeriod(from, to),

    valuation: {
      type: "CURRENT_STOCK_SNAPSHOT",
      estimatedInventoryValue: money(inventoryValue),
    },

    summary: {
      totalActiveItems: items.length,
      lowStockItems: lowStockItems.length,
      outOfStockItems: outOfStockItems.length,
    },

    movements: {
      period: getPeriod(from, to),
      breakdown: movementBreakdown,
    },

    lowStock: lowStockItems.map((item) => ({
      id: item.id,
      name: item.name,
      currentStock: quantity(item.currentStock),
      reorderLevel: quantity(item.reorderLevel),
      unit: item.unit,
    })),
  };
}

export async function getStaffPerformance({
  restaurantId,
  from,
  to,
}) {
  const history = await prisma.orderStatusHistory.findMany({
    where: {
      restaurantId,
      ...getDateRange(from, to),
    },
    select: {
      orderId: true,
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
        name: record.user?.name ?? "Unknown user",
        email: record.user?.email ?? null,
        ordersAccepted: 0,
        ordersPrepared: 0,
        ordersReady: 0,
        ordersServed: 0,
        ordersCancelled: 0,
        totalActions: 0,
        handledOrderIds: new Set(),
      });
    }

    const staff = staffMap.get(userId);

    staff.totalActions += 1;

    if (record.orderId) {
      staff.handledOrderIds.add(record.orderId);
    }

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

  const staff = Array.from(staffMap.values())
    .map((entry) => {
      const {
        handledOrderIds,
        ...staffData
      } = entry;

      return {
        ...staffData,
        uniqueOrdersHandled: handledOrderIds.size,
      };
    })
    .sort((a, b) => b.totalActions - a.totalActions);

  return {
    period: getPeriod(from, to),
    totalStaff: staff.length,
    staff,
  };
}
