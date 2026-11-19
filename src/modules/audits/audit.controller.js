import { listAuditLogs } from "./audit.service.js";

export async function getAuditLogs(req, res, next) {
  try {
    const result = await listAuditLogs({
      restaurantId: req.auth.restaurantId,
      ...req.validatedQuery,
    });

    res.status(200).json({
      success: true,
      message: "Audit logs retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}