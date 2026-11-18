
import {
  addRecipeIngredient,
  getMenuItemRecipe,
  updateRecipeIngredient,
  removeRecipeIngredient,
} from "./recipe.service.js";

export const addRecipeIngredientController = async (req, res, next) => {
  try {
    const ingredient = await addRecipeIngredient(
      req.auth.restaurantId,
      req.params.menuItemId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Recipe ingredient added successfully.",
      data: ingredient,
    });
  } catch (error) {
    next(error);
  }
};

export const getMenuItemRecipeController = async (req, res, next) => {
  try {
    const ingredients = await getMenuItemRecipe(
      req.auth.restaurantId,
      req.params.menuItemId
    );

    res.status(200).json({
      success: true,
      count: ingredients.length,
      data: ingredients,
    });
  } catch (error) {
    next(error);
  }
};

export const updateRecipeIngredientController = async (req, res, next) => {
  try {
    const ingredient = await updateRecipeIngredient(
      req.auth.restaurantId,
      req.params.ingredientId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Recipe ingredient updated successfully.",
      data: ingredient,
    });
  } catch (error) {
    next(error);
  }
};

export const removeRecipeIngredientController = async (req, res, next) => {
  try {
    await removeRecipeIngredient(
      req.auth.restaurantId,
      req.params.ingredientId
    );

    res.status(200).json({
      success: true,
      message: "Recipe ingredient removed successfully.",
    });
  } catch (error) {
    next(error);
  }
};
