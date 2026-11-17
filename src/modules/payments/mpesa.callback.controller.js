
import prisma from "../../config/database.js";
import { reconcileMpesaPayment } from "./mpesa.service.js";

const toCents = (value) => {
  const [whole, fraction = ""] = String(value).split(".");

  return (
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"))
  );
};

const normalizePhone = (phone) => {
  const digits = String(phone).replace(/\D/g, "");

  if (digits.startsWith("0")) {
    return `254${digits.slice(1)}`;
  }

  return digits;
};

const getMetadata = (items = []) =>
  Object.fromEntries(
    items.map((item) => [item.Name, item.Value])
  );

const updateCallbackEvent = async (eventId, data) => {
  await prisma.paymentCallbackEvent.update({
    where: { id: eventId },
    data: {
      ...data,
      processedAt: new Date(),
    },
  });
};

export const mpesaCallbackController = async (req, res) => {
  let eventId;

  try {
    const callback = req.body?.Body?.stkCallback;

    const checkoutRequestId =
      callback?.CheckoutRequestID || "UNKNOWN";

    // Persist the callback before attempting payment processing.
    const event = await prisma.paymentCallbackEvent.create({
      data: {
        checkoutRequestId,
        resultCode:
          callback?.ResultCode !== undefined
            ? String(callback.ResultCode)
            : null,
        resultDesc: callback?.ResultDesc || null,
        payload: req.body,
        processingStatus: "RECEIVED",
      },
    });

    eventId = event.id;

    if (!callback?.CheckoutRequestID) {
      await updateCallbackEvent(eventId, {
        processingStatus: "FAILED",
        processingError: "Invalid callback payload",
      });

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Callback recorded",
      });
    }

    const { CheckoutRequestID, ResultCode, CallbackMetadata } =
      callback;

    const payment = await prisma.payment.findUnique({
      where: {
        checkoutRequestId: CheckoutRequestID,
      },
    });

    if (!payment) {
      await updateCallbackEvent(eventId, {
        processingStatus: "UNMATCHED",
        processingError: "No payment found for this CheckoutRequestID",
      });

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Callback recorded for investigation",
      });
    }

    // Associate the event with its payment.
    await prisma.paymentCallbackEvent.update({
      where: { id: eventId },
      data: { paymentId: payment.id },
    });

    // Record repeated callbacks without applying the payment again.
    if (["FAILED", "REVERSED"].includes(payment.status)) {
      await updateCallbackEvent(eventId, {
        processingStatus: "DUPLICATE",
      });

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Callback already processed",
      });
    }

    if (payment.status === "COMPLETED") {
      const metadata = getMetadata(
        CallbackMetadata?.Item || []
      );

      const receipt = metadata.MpesaReceiptNumber;

      if (receipt && !payment.transactionId) {
        await prisma.payment.updateMany({
          where: {
            id: payment.id,
            status: "COMPLETED",
            transactionId: null,
          },
          data: {
            transactionId: String(receipt),
            reference: String(receipt),
          },
        });
      }

      await updateCallbackEvent(eventId, {
        processingStatus: "DUPLICATE",
      });

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Duplicate callback recorded",
      });
    }

    // Successful STK callback.
    if (Number(ResultCode) === 0) {
      const metadata = getMetadata(
        CallbackMetadata?.Item || []
      );

      const amount = metadata.Amount;
      const receipt = metadata.MpesaReceiptNumber;
      const phoneNumber = metadata.PhoneNumber;

      if (
        amount === undefined ||
        !receipt ||
        phoneNumber === undefined
      ) {
        await updateCallbackEvent(eventId, {
          processingStatus: "AWAITING_VERIFICATION",
          processingError: "Successful callback has incomplete transaction details",
        });

        return res.status(200).json({
          ResultCode: 0,
          ResultDesc: "Callback recorded; verification required",
        });
      }

      if (
        toCents(amount) !== toCents(payment.amount) ||
        normalizePhone(phoneNumber) !==
          normalizePhone(payment.phoneNumber)
      ) {
        await updateCallbackEvent(eventId, {
          processingStatus: "REVIEW_REQUIRED",
          processingError: "Callback amount or phone number does not match payment",
        });

        return res.status(200).json({
          ResultCode: 0,
          ResultDesc: "Callback recorded for investigation",
        });
      }

      // Verify the transaction through Safaricom STK Query.
      const reconciliation = await reconcileMpesaPayment({
        restaurantId: payment.restaurantId,
        paymentId: payment.id,
      });

      if (reconciliation.payment?.status === "COMPLETED") {
        await prisma.payment.updateMany({
          where: {
            id: payment.id,
            status: "COMPLETED",
            transactionId: null,
          },
          data: {
            transactionId: String(receipt),
            reference: String(receipt),
          },
        });

        await updateCallbackEvent(eventId, {
          processingStatus: "PROCESSED",
        });
      } else {
        await updateCallbackEvent(eventId, {
          processingStatus: "AWAITING_VERIFICATION",
          processingError:
            reconciliation.message ||
            "Safaricom has not yet confirmed the payment",
        });
      }
    } else {
      // Do not mark failed based on callback alone.
      const reconciliation = await reconcileMpesaPayment({
        restaurantId: payment.restaurantId,
        paymentId: payment.id,
      });

      await updateCallbackEvent(eventId, {
        processingStatus:
          ["FAILED", "REVERSED"].includes(
            reconciliation.payment?.status
          )
            ? "PROCESSED"
            : "AWAITING_VERIFICATION",
        processingError:
          reconciliation.message || null,
      });
    }

    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: "Callback recorded and processed",
    });
  } catch (error) {
    console.error("M-Pesa callback processing error:", error);

    if (eventId) {
      try {
        await updateCallbackEvent(eventId, {
          processingStatus: "FAILED",
          processingError: error.message,
        });
      } catch (loggingError) {
        console.error(
          "Callback event update failed:",
          loggingError
        );
      }
    }

    return res.status(500).json({
      ResultCode: 1,
      ResultDesc: "Callback processing failed",
    });
  }
};
