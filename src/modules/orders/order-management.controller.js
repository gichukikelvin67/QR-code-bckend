
import {
  getRestaurantOrders,
  getRestaurantOrderById,
  updateRestaurantOrderStatus,
} from "./order-management.service.js";
import { getSocketInstance } from "../../sockets/socket-instance.js";

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


export async function updateOrderStatusController(req, res, next) {
  try {
    const order = await updateRestaurantOrderStatus(
      req.auth.restaurantId,
      req.params.orderId,
      req.body.status,
      req.auth.role,
      req.auth.userId
    );

    const io = getSocketInstance();

    if (io) {
      const eventPayload = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        tableNumber: order.session?.table?.tableNumber,
        updatedAt: order.updatedAt,
      };

      const rooms = [
        `restaurant:${req.auth.restaurantId}:kitchen`,
        `restaurant:${req.auth.restaurantId}:bar`,
        `restaurant:${req.auth.restaurantId}:service`,
      ];

      for (const room of rooms) {
        io.to(room).emit("order:status-updated", eventPayload);
      }
    }

    res.status(200).json({
      success: true,
      message: `Order status updated to ${order.status}.`,
      data: order,
    });
  } catch (error) {
    next(error);
  }
}
