
import {
  createCustomer,
  listCustomers,
  getCustomerById,
  updateCustomer,
} from "./customer.service.js";

export async function createCustomerHandler(req, res, next) {
  try {
    const customer = await createCustomer(
      req.auth.restaurantId,
      req.auth.userId,
      req.validatedBody
    );

    res.status(201).json({
      success: true,
      message: "Customer created successfully.",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
}

export async function listCustomersHandler(req, res, next) {
  try {
    const result = await listCustomers(
      req.auth.restaurantId,
      req.validatedQuery
    );

    res.status(200).json({
      success: true,
      message: "Customers retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerHandler(req, res, next) {
  try {
    const customer = await getCustomerById(
      req.auth.restaurantId,
      req.validatedParams.customerId
    );

    res.status(200).json({
      success: true,
      message: "Customer retrieved successfully.",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCustomerHandler(req, res, next) {
  try {
    const customer = await updateCustomer(
      req.auth.restaurantId,
      req.auth.userId,
      req.validatedParams.customerId,
      req.validatedBody
    );

    res.status(200).json({
      success: true,
      message: "Customer updated successfully.",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
}
