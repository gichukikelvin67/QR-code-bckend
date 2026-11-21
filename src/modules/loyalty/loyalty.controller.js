
import {
  awardPointsForPayment,
  redeemPoints,
  adjustCustomerPoints,
  getCustomerLoyaltyHistory,
} from "./loyalty.service.js";

// Award points after a verified payment
export const awardPointsController = async (req, res, next) => {
  try {
    const result = await awardPointsForPayment({
      restaurantId: req.auth.restaurantId,
      paymentId: req.validatedParams.paymentId,
    });

    return res.status(200).json({
      success: true,
      message: "Loyalty points processing completed.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Redeem points against a bill
export const redeemPointsController = async (req, res, next) => {
  try {
    const result = await redeemPoints({
      restaurantId: req.auth.restaurantId,
      customerId: req.validatedBody.customerId,
      billId: req.validatedBody.billId,
      points: req.validatedBody.points,
      idempotencyKey: req.validatedBody.idempotencyKey,
      userId: req.auth.userId,
      userRole: req.auth.role,
    });

    return res.status(200).json({
      success: true,
      message: "Loyalty points redeemed successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Manager-authorized points adjustment
export const adjustPointsController = async (req, res, next) => {
  try {
    const result = await adjustCustomerPoints({
      restaurantId: req.auth.restaurantId,
      customerId: req.validatedParams.customerId,
      points: req.validatedBody.points,
      description: req.validatedBody.description,
      idempotencyKey: req.validatedBody.idempotencyKey,
      userId: req.auth.userId,
      userRole: req.auth.role,
    });

    return res.status(200).json({
      success: true,
      message: "Customer loyalty points adjusted successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Customer loyalty history
export const getCustomerLoyaltyHistoryController = async (
  req,
  res,
  next
) => {
  try {
    const history = await getCustomerLoyaltyHistory({
      restaurantId: req.auth.restaurantId,
      customerId: req.validatedParams.customerId,
    });

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};
