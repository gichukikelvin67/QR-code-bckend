
import {
  initiateMpesaPayment,
  reconcileMpesaPayment,
  getMpesaPaymentStatus,
} from "./mpesa.service.js";

// Initiate an M-Pesa STK Push.
export const initiateStkPushController = async (req, res, next) => {
  try {
    const result = await initiateMpesaPayment({
      restaurantId: req.auth.restaurantId,
      ...req.body,
    });

    return res.status(result.duplicate ? 200 : 202).json({
      success: true,
      message: result.duplicate
        ? "Existing M-Pesa payment returned"
        : "M-Pesa STK Push initiated",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Query and reconcile an existing M-Pesa payment.
export const queryStkPushController = async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(paymentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID",
      });
    }

    const result = await reconcileMpesaPayment({
      restaurantId: req.auth.restaurantId,
      paymentId,
    });

    return res.status(200).json({
      success: true,
      message: "M-Pesa payment status checked",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};


export const getMpesaPaymentStatusController = async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(paymentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID",
      });
    }

    const payment = await getMpesaPaymentStatus({
      restaurantId: req.auth.restaurantId,
      paymentId,
    });

    return res.status(200).json({
      success: true,
      message: "M-Pesa payment retrieved successfully",
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};
