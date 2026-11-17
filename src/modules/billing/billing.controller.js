import { sessionIdParamsSchema ,
  billIdParamsSchema,
  listBillsQuerySchema,
  splitBillSchema,
  createPaymentSchema,
} from "./billing.validation.js";

import { generateSessionBill ,
  listRestaurantBills,
  getRestaurantBillById,
  splitBill,
  recordBillPayment,
} from "./billing.service.js";

export async function generateBillController(req, res, next) {
  try {
    const validation = sessionIdParamsSchema.safeParse(
      req.params
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid dining session ID.",
        errors: validation.error.issues,
      });
    }

    const bill = await generateSessionBill({
      restaurantId: req.auth.restaurantId,
      sessionId: validation.data.sessionId,
    });

    return res.status(201).json({
      success: true,
      message: "Bill generated successfully.",
      data: bill,
    });
  } catch (error) {
    next(error);
  }
}

export const listBillsController = async (req, res, next) => {
  try {
    const query = listBillsQuerySchema.parse(req.query);

    const result = await listRestaurantBills({
      restaurantId: req.auth.restaurantId,
      ...query,
    });

    return res.status(200).json({
      success: true,
      data: result.bills,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const getBillController = async (req, res, next) => {
  try {
    const { billId } = billIdParamsSchema.parse(req.params);

    const bill = await getRestaurantBillById({
      restaurantId: req.auth.restaurantId,
      billId,
    });

    return res.status(200).json({
      success: true,
      data: bill,
    });
  } catch (error) {
    next(error);
  }
};

export const splitBillController = async (req, res, next) => {
  try {
    const { billId } = billIdParamsSchema.parse(req.params);
    const { items } = splitBillSchema.parse(req.body);

    const result = await splitBill({
      restaurantId: req.auth.restaurantId,
      billId,
      items,
    });

    return res.status(201).json({
      success: true,
      message: "Bill split successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const recordPaymentController = async (req, res, next) => {
  try {
    const { billId } = billIdParamsSchema.parse(req.params);

    const payload = createPaymentSchema.parse(req.body);

    const result = await recordBillPayment({
      restaurantId: req.auth.restaurantId,
      billId,
      ...payload,
    });

    return res.status(result.duplicate ? 200 : 201).json({
      success: true,
      message: result.duplicate
        ? "Existing payment returned"
        : "Payment recorded successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};