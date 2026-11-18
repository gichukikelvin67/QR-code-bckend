
import {
  createCustomer,
  listCustomers,
  getCustomerById,
  updateCustomer,
  awardPointsForPayment,
  redeemPoints,
  adjustCustomerPoints,
  getCustomerLoyaltyHistory,
} from "./loyalty.service.js";

// Create customer
export const createCustomerController = async (req, res, next) => {
  try {
    const customer = await createCustomer({
      restaurantId: req.auth.restaurantId,
      ...req.body,
    });

    return res.status(201).json({
      success: true,
      message: "Customer created successfully.",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// List customers
export const listCustomersController = async (req, res, next) => {
  try {
    const customers = await listCustomers({
      restaurantId: req.auth.restaurantId,
    });

    return res.status(200).json({
      success: true,
      data: customers,
    });
  } catch (error) {
    next(error);
  }
};

// Get customer
export const getCustomerController = async (req, res, next) => {
  try {
    const customer = await getCustomerById({
      restaurantId: req.auth.restaurantId,
      customerId: req.params.customerId,
    });

    return res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// Update customer
export const updateCustomerController = async (req, res, next) => {
  try {
    const customer = await updateCustomer({
      restaurantId: req.auth.restaurantId,
      customerId: req.params.customerId,
      data: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully.",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// Award points for a verified payment
export const awardPointsController = async (req, res, next) => {
  try {
    const result = await awardPointsForPayment({
      restaurantId: req.auth.restaurantId,
      paymentId: req.params.paymentId,
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

// Redeem loyalty points
export const redeemPointsController = async (req, res, next) => {
  try {
    const result = await redeemPoints({
      restaurantId: req.auth.restaurantId,
      customerId: req.body.customerId,
      billId: req.body.billId,
      points: req.body.points,
      idempotencyKey: req.body.idempotencyKey,
      userId: req.auth.userId,
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

// Adjust points
export const adjustPointsController = async (req, res, next) => {
  try {
    const result = await adjustCustomerPoints({
      restaurantId: req.auth.restaurantId,
      customerId: req.params.customerId,
      points: req.body.points,
      description: req.body.description,
      idempotencyKey: req.body.idempotencyKey,
      userId: req.auth.userId,
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

// Loyalty transaction history
export const getCustomerLoyaltyHistoryController = async (
  req,
  res,
  next
) => {
  try {
    const history = await getCustomerLoyaltyHistory({
      restaurantId: req.auth.restaurantId,
      customerId: req.params.customerId,
    });

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};
