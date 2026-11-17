import { sessionIdParamsSchema } from "./billing.validation.js";
import { generateSessionBill } from "./billing.service.js";

export async function generateBillController(req, res, next) {
  try {
    const validation = sessionIdParamsSchema.safeParse(
      req.params
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid dining session ID.",
        errors: validation.error.issues,
      });
    }

    const bill = await generateSessionBill({
      restaurantId: req.auth.restaurantId,
      sessionId: validation.data.sessionId,
    });

    return res.status(201).json({
      success: true,
      message: "Bill generated successfully.",
      data: bill,
    });
  } catch (error) {
    next(error);
  }
}