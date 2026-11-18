
import {
  applyDiscount,
  reverseDiscount,
  listBillDiscounts,
  getDiscountById,
} from "./discount.service.js";

export const applyDiscountController = async (req, res, next) => {
  try {
    const discount = await applyDiscount({
      restaurantId: req.auth.restaurantId,
      billId: req.body.billId,
      type: req.body.type,
      value: req.body.value,
      reason: req.body.reason,
      userId: req.auth.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Discount applied successfully.",
      data: discount,
    });
  } catch (error) {
    next(error);
  }
};

export const reverseDiscountController = async (req, res, next) => {
  try {
    const result = await reverseDiscount({
      restaurantId: req.auth.restaurantId,
      discountId: req.params.discountId,
      reason: req.body.reason,
      userId: req.auth.userId,
    });

    return res.status(200).json({
      success: true,
      message: "Discount reversed successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const listBillDiscountsController = async (req, res, next) => {
  try {
    const discounts = await listBillDiscounts({
      restaurantId: req.auth.restaurantId,
      billId: req.params.billId,
    });

    return res.status(200).json({
      success: true,
      data: discounts,
    });
  } catch (error) {
    next(error);
  }
};

export const getDiscountController = async (req, res, next) => {
  try {
    const discount = await getDiscountById({
      restaurantId: req.auth.restaurantId,
      discountId: req.params.discountId,
    });

    return res.status(200).json({
      success: true,
      data: discount,
    });
  } catch (error) {
    next(error);
  }
};
