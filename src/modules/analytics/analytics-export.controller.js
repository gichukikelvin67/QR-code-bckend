
import { exportAnalyticsReport } from "./analytics-export.service.js";
import {
  analyticsOverviewQuerySchema,
} from "./analytics.validation.js";

export async function exportAnalyticsController(req, res, next) {
  try {
    const validation = analyticsOverviewQuerySchema.safeParse(
      req.query
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid export date filters.",
        errors: validation.error.flatten(),
      });
    }

    const { csv, filename } = await exportAnalyticsReport({
      restaurantId: req.auth.restaurantId,
      report: req.params.report,
      ...validation.data,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
}
