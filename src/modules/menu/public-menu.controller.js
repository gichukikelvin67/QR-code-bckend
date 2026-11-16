
import { getPublicRestaurantMenu } from "./public-menu.service.js";

export async function getPublicMenuController(req, res, next) {
  try {
    const result = await getPublicRestaurantMenu(
      req.params.restaurantSlug,
      req.query.table
    );

    res.status(200).json({
      success: true,
      message: "Restaurant menu retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
