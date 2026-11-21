
import {
  getAnalyticsOverview,
  getSalesTrends,
  getPaymentMethodsReport,
  getTopSellingItems,
  getOrderPerformance,
  getInventoryInsights,
  getStaffPerformance,
} from "./analytics.service.js";

const DEFAULT_TOP_ITEMS_LIMIT = 10;

function escapeCsv(value) {
  if (value === null || value === undefined) {
    return '""';
  }

  let text = String(value);

  // Prevent spreadsheet formula injection.
  if (/^[\s\u0000-\u001F]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  // Escape double quotes according to CSV rules.
  return `"${text.replace(/"/g, '""')}"`;
}

function createCsv(headers, rows) {
  const headerRow = headers
    .map(escapeCsv)
    .join(",");

  const dataRows = rows.map((row) =>
    headers
      .map((header) => escapeCsv(row[header]))
      .join(",")
  );

  // BOM improves compatibility with spreadsheet applications.
  return "\uFEFF" + [headerRow, ...dataRows].join("\r\n");
}

function createFilename(report, from, to) {
  const safeReport = String(report).replace(/[^a-z0-9-]/gi, "");

  const safeFrom = from ?? "all";
  const safeTo = to ?? "all";

  return `analytics-${safeReport}-${safeFrom}-${safeTo}.csv`;
}

export async function exportAnalyticsReport({
  restaurantId,
  report,
  from,
  to,
  limit = DEFAULT_TOP_ITEMS_LIMIT,
}) {
  const params = {
    restaurantId,
    from,
    to,
  };

  let result;
  let headers;
  let rows;

  switch (report) {
    case "overview": {
      result = await getAnalyticsOverview(params);

      headers = ["metric", "value"];

      rows = [
        {
          metric: "Gross Payments",
          value: result.revenue.grossPayments,
        },
        {
          metric: "Completed Refunds",
          value: result.revenue.completedRefunds,
        },
        {
          metric: "Net Revenue",
          value: result.revenue.netRevenue,
        },
        {
          metric: "Total Orders",
          value: result.orders.total,
        },
        {
          metric: "Non-Cancelled Orders",
          value: result.orders.nonCancelled,
        },
        {
          metric: "Served Orders",
          value: result.orders.served,
        },
        {
          metric: "Average Order Value (Served Orders)",
          value: result.orders.averageOrderValue,
        },
        {
          metric: "Current Outstanding Balance",
          value: result.outstanding.currentBalance,
        },
        {
          metric: "Outstanding Balance on Bills Created During Period",
          value: result.outstanding.periodCreatedBalance,
        },
      ];

      break;
    }

    case "trends": {
      result = await getSalesTrends(params);

      headers = [
        "date",
        "grossPayments",
        "refunds",
        "netRevenue",
        "orders",
      ];

      rows = result.trends;
      break;
    }

    case "payment-methods": {
      result = await getPaymentMethodsReport(params);

      headers = [
        "method",
        "transactionCount",
        "totalAmount",
        "percentage",
      ];

      rows = result.methods;
      break;
    }

    case "top-selling-items": {
      result = await getTopSellingItems({
        ...params,
        limit,
      });

      headers = [
        "menuItemId",
        "itemName",
        "quantitySold",
        "salesValue",
        "orderLines",
      ];

      rows = result.items;
      break;
    }

    case "order-performance": {
      result = await getOrderPerformance(params);

      headers = [
        "status",
        "count",
        "orderValue",
      ];

      rows = result.breakdown;
      break;
    }

    case "inventory": {
      result = await getInventoryInsights(params);

      headers = [
        "id",
        "name",
        "currentStock",
        "reorderLevel",
        "unit",
      ];

      // This report intentionally exports low-stock items only.
      rows = result.lowStock;
      break;
    }

    case "staff-performance": {
      result = await getStaffPerformance(params);

      headers = [
        "userId",
        "name",
        "email",
        "ordersAccepted",
        "ordersPrepared",
        "ordersReady",
        "ordersServed",
        "ordersCancelled",
        "totalActions",
        "uniqueOrdersHandled",
      ];

      rows = result.staff;
      break;
    }

    default:
      throw Object.assign(
        new Error("Unsupported analytics report type."),
        { statusCode: 400 }
      );
  }

  return {
    csv: createCsv(headers, rows),
    filename: createFilename(report, from, to),
  };
}
