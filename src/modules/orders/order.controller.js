
import { createPublicOrder } from "./order.service.js";

export async function createPublicOrderController(req, res, next) {
  try {
    const result = await createPublicOrder(
      req.params.restaurantSlug,
      req.query.table,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Your order has been submitted successfully.",
      data: {
        id: result.order.id,
        orderNumber: result.order.orderNumber,
        status: result.order.status,
        source: result.order.source,
        subtotal: result.order.subtotal,
        total: result.order.total,
        notes: result.order.notes,
        tableNumber:
          result.order.session.table.tableNumber,
        items: result.order.items,
        createdAt: result.order.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
