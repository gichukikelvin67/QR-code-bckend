
import {
  getAnalyticsOverview,
  getSalesTrends,
  getPaymentMethodsReport,
  getTopSellingItems,
  getOrderPerformance,
  getInventoryInsights,
  getStaffPerformance,
} from "./analytics.service.js";


function escapeCsv(value) {
  let text = String(value ?? "");

  // Prevent spreadsheet formula injection.
  if (/^[\s\u0000-\u001F]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  // Escape quotes according to CSV rules.
  return `"${text.replace(/"/g, '""')}"`;
}


function createCsv(headers, rows) {
  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsv(row[header])).join(",")
    ),
  ].join("\r\n");
}

export async function exportAnalyticsReport({
  restaurantId,
  report,
  from,
  to,
}) {
  const params = { restaurantId, from, to };

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
          metric: "Average Order Value",
          value: result.orders.averageOrderValue,
        },
        {
          metric: "Outstanding Balance",
          value: result.outstanding.billBalance,
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
      result = await getTopSellingItems(params);

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

      headers = ["status", "count", "orderValue"];

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
    filename: `analytics-${report}-${from ?? "all"}-${to ?? "all"}.csv`,
  };
}
//cvs report