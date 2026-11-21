
import { exportAnalyticsReport } from "./analytics-export.service.js";
import {
  analyticsExportQuerySchema,
} from "./analytics.validation.js";

export async function exportAnalyticsController(req, res, next) {
  try {
    const validation = analyticsExportQuerySchema.safeParse(
      req.query
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid export filters.",
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
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
}
