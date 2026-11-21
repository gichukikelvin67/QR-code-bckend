
import {
  getAnalyticsOverview,
  getSalesTrends,
  getPaymentMethodsReport,
  getTopSellingItems,
  getOrderPerformance,
  getInventoryInsights,
  getStaffPerformance,
} from "./analytics.service.js";

import {
  analyticsOverviewQuerySchema,
  analyticsTopSellingQuerySchema,
} from "./analytics.validation.js";

export async function analyticsOverview(req, res, next) {
  try {
    const validation = analyticsOverviewQuerySchema.safeParse(
      req.query
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid analytics date filters.",
        errors: validation.error.flatten(),
      });
    }

    const result = await getAnalyticsOverview({
      restaurantId: req.auth.restaurantId,
      ...validation.data,
    });

    return res.status(200).json({
      success: true,
      message: "Analytics overview retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function salesTrends(req, res, next) {
  try {
    const validation = analyticsOverviewQuerySchema.safeParse(
      req.query
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid analytics date filters.",
        errors: validation.error.flatten(),
      });
    }

    const result = await getSalesTrends({
      restaurantId: req.auth.restaurantId,
      ...validation.data,
    });

    return res.status(200).json({
      success: true,
      message: "Sales trends retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function paymentMethodsReport(req, res, next) {
  try {
    const validation = analyticsOverviewQuerySchema.safeParse(
      req.query
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid analytics date filters.",
        errors: validation.error.flatten(),
      });
    }

    const result = await getPaymentMethodsReport({
      restaurantId: req.auth.restaurantId,
      ...validation.data,
    });

    return res.status(200).json({
      success: true,
      message: "Payment methods report retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}


export async function topSellingItems(req, res, next) {
  try {
    const validation = analyticsTopSellingQuerySchema.safeParse(
      req.query
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid top-selling report filters.",
        errors: validation.error.flatten(),
      });
    }

    const data = await getTopSellingItems({
      restaurantId: req.auth.restaurantId,
      ...validation.data,
    });

    return res.status(200).json({
      success: true,
      message: "Top-selling items retrieved successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function orderPerformance(req, res, next) {
  try {
    const validation = analyticsOverviewQuerySchema.safeParse(
      req.query
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid analytics date filters.",
        errors: validation.error.flatten(),
      });
    }

    const result = await getOrderPerformance({
      restaurantId: req.auth.restaurantId,
      ...validation.data,
    });

    return res.status(200).json({
      success: true,
      message: "Order performance retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function inventoryInsights(req, res, next) {
  try {
    const validation = analyticsOverviewQuerySchema.safeParse(
      req.query
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid analytics date filters.",
        errors: validation.error.flatten(),
      });
    }

    const result = await getInventoryInsights({
      restaurantId: req.auth.restaurantId,
      ...validation.data,
    });

    return res.status(200).json({
      success: true,
      message: "Inventory insights retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function staffPerformance(req, res, next) {
  try {
    const validation = analyticsOverviewQuerySchema.safeParse(
      req.query
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid analytics date filters.",
        errors: validation.error.flatten(),
      });
    }

    const result = await getStaffPerformance({
      restaurantId: req.auth.restaurantId,
      ...validation.data,
    });

    return res.status(200).json({
      success: true,
      message: "Staff performance retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}



