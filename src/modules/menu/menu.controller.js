
import {
  createCategory,
  getCategories,
  updateCategory,
  createMenuItem,
  getMenuItems,
  getMenuItemById,
  updateMenuItem,
} from "./menu.service.js";

// CATEGORIES

export async function createCategoryController(req, res, next) {
  try {
    const category = await createCategory(
      req.auth.restaurantId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Menu category created successfully.",
      data: category,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCategoriesController(req, res, next) {
  try {
    const categories = await getCategories(
      req.auth.restaurantId
    );

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCategoryController(req, res, next) {
  try {
    const category = await updateCategory(
      req.auth.restaurantId,
      req.params.categoryId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Category updated successfully.",
      data: category,
    });
  } catch (error) {
    next(error);
  }
}

// MENU ITEMS

export async function createMenuItemController(req, res, next) {
  try {
    const item = await createMenuItem(
      req.auth.restaurantId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Menu item created successfully.",
      data: item,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMenuItemsController(req, res, next) {
  try {
    const items = await getMenuItems(
      req.auth.restaurantId,
      req.query
    );

    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMenuItemController(req, res, next) {
  try {
    const item = await getMenuItemById(
      req.auth.restaurantId,
      req.params.itemId
    );

    res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMenuItemController(req, res, next) {
  try {
    const item = await updateMenuItem(
      req.auth.restaurantId,
      req.params.itemId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Menu item updated successfully.",
      data: item,
    });
  } catch (error) {
    next(error);
  }
}
