
import {
  requestRefund,
  approveRefund,
  completeRefund,
  rejectRefund,
  listPaymentRefunds,
  getRefundById,
} from "./refund.service.js";

export const requestRefundController = async (req, res, next) => {
  try {
    const refund = await requestRefund({
      restaurantId: req.auth.restaurantId,
      paymentId: req.body.paymentId,
      amount: req.body.amount,
      reason: req.body.reason,
      idempotencyKey: req.body.idempotencyKey,
      userId: req.auth.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Refund request submitted successfully.",
      data: refund,
    });
  } catch (error) {
    next(error);
  }
};

export const approveRefundController = async (req, res, next) => {
  try {
    const refund = await approveRefund({
      restaurantId: req.auth.restaurantId,
      refundId: req.params.refundId,
      userId: req.auth.userId,
    });

    return res.status(200).json({
      success: true,
      message: "Refund approved and moved to processing.",
      data: refund,
    });
  } catch (error) {
    next(error);
  }
};

export const completeRefundController = async (req, res, next) => {
  try {
    const refund = await completeRefund({
      restaurantId: req.auth.restaurantId,
      refundId: req.params.refundId,
      providerReference: req.body.providerReference,
    });

    return res.status(200).json({
      success: true,
      message: "Refund completion recorded.",
      data: refund,
    });
  } catch (error) {
    next(error);
  }
};

export const rejectRefundController = async (req, res, next) => {
  try {
    const refund = await rejectRefund({
      restaurantId: req.auth.restaurantId,
      refundId: req.params.refundId,
      reason: req.body.reason,
      userId: req.auth.userId,
    });

    return res.status(200).json({
      success: true,
      message: "Refund request rejected.",
      data: refund,
    });
  } catch (error) {
    next(error);
  }
};

export const listPaymentRefundsController = async (req, res, next) => {
  try {
    const refunds = await listPaymentRefunds({
      restaurantId: req.auth.restaurantId,
      paymentId: req.params.paymentId,
    });

    return res.status(200).json({
      success: true,
      data: refunds,
    });
  } catch (error) {
    next(error);
  }
};

export const getRefundController = async (req, res, next) => {
  try {
    const refund = await getRefundById({
      restaurantId: req.auth.restaurantId,
      refundId: req.params.refundId,
    });

    return res.status(200).json({
      success: true,
      data: refund,
    });
  } catch (error) {
    next(error);
  }
};
