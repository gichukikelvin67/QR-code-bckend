
import {
  getRestaurantOrders,
  getRestaurantOrderById,
  updateRestaurantOrderStatus,
} from "./order-management.service.js";

export async function getOrdersController(req, res, next) {
  try {
    const orders = await getRestaurantOrders(
      req.auth.restaurantId,
      req.query.status
    );

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
}

export async function getOrderController(req, res, next) {
  try {
    const order = await getRestaurantOrderById(
      req.auth.restaurantId,
      req.params.orderId
    );

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateOrderStatusController(
  req,
  res,
  next
) {
  try {
    const order = await updateRestaurantOrderStatus(
      req.auth.restaurantId,
      req.params.orderId,
      req.body.status,
      req.auth.role
    );

    res.status(200).json({
      success: true,
      message: `Order status updated to ${order.status}.`,
      data: order,
    });
  } catch (error) {
    next(error);
  }
}
