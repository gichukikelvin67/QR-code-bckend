
import {
  addEmployee,
  listEmployees,
  getEmployee,
  updateEmployeeRole,
  updateEmployeeStatus,
} from "./employee.service.js";

export async function createEmployee(req, res, next) {
  try {
    const employee = await addEmployee(
      req.auth.restaurantId,
      req.auth.userId,
      req.auth.role,
      req.validatedBody
    );

    res.status(201).json({
      success: true,
      message: "Employee added successfully.",
      data: employee,
    });
  } catch (error) {
    next(error);
  }
}

export async function getEmployees(req, res, next) {
  try {
    const result = await listEmployees(
      req.auth.restaurantId,
      req.validatedQuery
    );

    res.status(200).json({
      success: true,
      message: "Employees retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getEmployeeById(req, res, next) {
  try {
    const employee = await getEmployee(
      req.auth.restaurantId,
      req.validatedParams.employeeId
    );

    res.status(200).json({
      success: true,
      message: "Employee retrieved successfully.",
      data: employee,
    });
  } catch (error) {
    next(error);
  }
}

export async function changeEmployeeRole(req, res, next) {
  try {
    const employee = await updateEmployeeRole(
      req.auth.restaurantId,
      req.auth.userId,
      req.auth.role,
      req.validatedParams.employeeId,
      req.validatedBody
    );

    res.status(200).json({
      success: true,
      message: "Employee role updated successfully.",
      data: employee,
    });
  } catch (error) {
    next(error);
  }
}

export async function changeEmployeeStatus(req, res, next) {
  try {
    const employee = await updateEmployeeStatus(
      req.auth.restaurantId,
      req.auth.userId,
      req.auth.role,
      req.validatedParams.employeeId,
      req.validatedBody.isActive
    );

    res.status(200).json({
      success: true,
      message: "Employee status updated successfully.",
      data: employee,
    });
  } catch (error) {
    next(error);
  }
}
