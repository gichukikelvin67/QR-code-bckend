
import {
  openCustomerTab,
  listCustomerTabs,
  getCustomerTab,
  attachBillToTab,
  closeCustomerTab,
  suspendCustomerTab,
  reactivateCustomerTab,
} from "./tab.service.js";

export async function createTab(req, res, next) {
  try {
    const tab = await openCustomerTab(
      req.auth.restaurantId,
      req.auth.userId,
      req.auth.role,
      req.validatedBody
    );

    res.status(201).json({
      success: true,
      message: "Customer tab opened successfully.",
      data: tab,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTabs(req, res, next) {
  try {
    const result = await listCustomerTabs(
      req.auth.restaurantId,
      req.validatedQuery
    );

    res.status(200).json({
      success: true,
      message: "Customer tabs retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTabById(req, res, next) {
  try {
    const tab = await getCustomerTab(
      req.auth.restaurantId,
      req.validatedParams.tabId
    );

    res.status(200).json({
      success: true,
      message: "Customer tab retrieved successfully.",
      data: tab,
    });
  } catch (error) {
    next(error);
  }
}

export async function attachBill(req, res, next) {
  try {
    const bill = await attachBillToTab(
      req.auth.restaurantId,
      req.auth.userId,
      req.auth.role,
      req.validatedParams.tabId,
      req.validatedBody.billId
    );

    res.status(200).json({
      success: true,
      message: "Bill attached to customer tab successfully.",
      data: bill,
    });
  } catch (error) {
    next(error);
  }
}

export async function closeTab(req, res, next) {
  try {
    const tab = await closeCustomerTab(
      req.auth.restaurantId,
      req.auth.userId,
      req.auth.role,
      req.validatedParams.tabId,
      req.validatedBody
    );

    res.status(200).json({
      success: true,
      message: "Customer tab closed successfully.",
      data: tab,
    });
  } catch (error) {
    next(error);
  }
}

export async function suspendTab(req, res, next) {
  try {
    const tab = await suspendCustomerTab(
      req.auth.restaurantId,
      req.auth.userId,
      req.auth.role,
      req.validatedParams.tabId,
      req.validatedBody.reason
    );

    res.status(200).json({
      success: true,
      message: "Customer tab suspended successfully.",
      data: tab,
    });
  } catch (error) {
    next(error);
  }
}

export async function reactivateTab(req, res, next) {
  try {
    const tab = await reactivateCustomerTab(
      req.auth.restaurantId,
      req.auth.userId,
      req.auth.role,
      req.validatedParams.tabId
    );

    res.status(200).json({
      success: true,
      message: "Customer tab reactivated successfully.",
      data: tab,
    });
  } catch (error) {
    next(error);
  }
}
