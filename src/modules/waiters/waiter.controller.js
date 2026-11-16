
import { z } from "zod";
import {
  getWaiterQueue,
  serveOrderItem,
} from "./waiter.service.js";

const itemIdSchema = z.string().uuid();

export async function getWaiterQueueController(req, res, next) {
  try {
    const items = await getWaiterQueue(req.auth.restaurantId);

    return res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    next(error);
  }
}

export async function serveOrderItemController(req, res, next) {
  try {
    const validation = itemIdSchema.safeParse(req.params.itemId);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid order item ID.",
      });
    }

    const item = await serveOrderItem({
      restaurantId: req.auth.restaurantId,
      itemId: validation.data,
      userId: req.auth.userId,
    });

    return res.status(200).json({
      success: true,
      message: "Item marked as served.",
      data: item,
    });
  } catch (error) {
    next(error);
  }
}
