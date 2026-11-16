
import {
  getCurrentRestaurant,
  updateRestaurant,
} from "./restaurant.service.js";

export async function getRestaurant(req, res, next) {
  try {
    const restaurant = await getCurrentRestaurant(
      req.auth.restaurantId
    );

    res.status(200).json({
      success: true,
      data: restaurant,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateRestaurantDetails(req, res, next) {
  try {
    const restaurant = await updateRestaurant(
      req.auth.restaurantId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Restaurant details updated successfully.",
      data: restaurant,
    });
  } catch (error) {
    next(error);
  }
}
