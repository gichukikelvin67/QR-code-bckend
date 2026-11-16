
import {
  createTable,
  getRestaurantTables,
  getTableById,
  updateTable,
  generateTableQRCode,
} from "./table.service.js";

export async function createTableController(req, res, next) {
  try {
    const table = await createTable(
      req.auth.restaurantId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Table created successfully.",
      data: table,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTablesController(req, res, next) {
  try {
    const tables = await getRestaurantTables(req.auth.restaurantId);

    res.status(200).json({
      success: true,
      count: tables.length,
      data: tables,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTableController(req, res, next) {
  try {
    const table = await getTableById(
      req.auth.restaurantId,
      req.params.tableId
    );

    res.status(200).json({
      success: true,
      data: table,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTableController(req, res, next) {
  try {
    const table = await updateTable(
      req.auth.restaurantId,
      req.params.tableId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Table updated successfully.",
      data: table,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTableQRCodeController(req, res, next) {
  try {
    const qrCode = await generateTableQRCode(
      req.auth.restaurantId,
      req.params.tableId
    );

    res.status(200).json({
      success: true,
      data: qrCode,
    });
  } catch (error) {
    next(error);
  }
}
