
import prisma from "../../config/database.js";
import { createAuditLog } from "../audits/audit.service.js";
import { reconcileMpesaPayment } from "./mpesa.service.js";

const toCents = (value) => {
  const [whole, fraction = ""] = String(value).split(".");

  return BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"));
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

// Audit failures must not prevent Safaricom callback acknowledgement.
const recordPaymentAudit = async ({
  payment,
  action,
  description,
  metadata = {},
}) => {
  try {
    await createAuditLog({
      restaurantId: payment.restaurantId,
      userId: null,
      action,
      resource: "PAYMENT",
      resourceId: payment.id,
      description,
      metadata,
    });
  } catch (error) {
    console.error("M-Pesa audit logging failed:", error);
  }
};

export const mpesaCallbackController = async (req, res) => {
  let eventId;
  let paymentForAudit;

  try {
    const callback = req.body?.Body?.stkCallback;
    const checkoutRequestId =
      callback?.CheckoutRequestID || "UNKNOWN";

    // Persist callback before attempting payment processing.
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
        processingError:
          "No payment found for this CheckoutRequestID",
      });

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Callback recorded for investigation",
      });
    }

    paymentForAudit = payment;

    await prisma.paymentCallbackEvent.update({
      where: { id: eventId },
      data: { paymentId: payment.id },
    });

    await recordPaymentAudit({
      payment,
      action: "MPESA_CALLBACK_RECEIVED",
      description: "An M-Pesa STK callback was received.",
      metadata: {
        callbackEventId: eventId,
        checkoutRequestId: CheckoutRequestID,
        resultCode: String(ResultCode),
      },
    });

    // Already failed or reversed.
    if (["FAILED", "REVERSED"].includes(payment.status)) {
      await updateCallbackEvent(eventId, {
        processingStatus: "DUPLICATE",
      });

      await recordPaymentAudit({
        payment,
        action: "MPESA_CALLBACK_DUPLICATE",
        description: "A callback was received for an already terminal payment.",
        metadata: {
          callbackEventId: eventId,
          paymentStatus: payment.status,
        },
      });

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Callback already processed",
      });
    }

    // Already completed.
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

      await recordPaymentAudit({
        payment,
        action: "MPESA_CALLBACK_DUPLICATE",
        description: "A duplicate callback was received for a completed payment.",
        metadata: {
          callbackEventId: eventId,
          paymentStatus: "COMPLETED",
        },
      });

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Duplicate callback recorded",
      });
    }

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
          processingError:
            "Successful callback has incomplete transaction details",
        });

        await recordPaymentAudit({
          payment,
          action: "MPESA_PAYMENT_REVIEW_REQUIRED",
          description: "The successful callback contained incomplete transaction details.",
          metadata: {
            callbackEventId: eventId,
            reason: "INCOMPLETE_CALLBACK_DETAILS",
          },
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
          processingError:
            "Callback amount or phone number does not match payment",
        });

        await recordPaymentAudit({
          payment,
          action: "MPESA_PAYMENT_REVIEW_REQUIRED",
          description: "Callback details did not match the payment record.",
          metadata: {
            callbackEventId: eventId,
            reason: "PAYMENT_DETAILS_MISMATCH",
          },
        });

        return res.status(200).json({
          ResultCode: 0,
          ResultDesc: "Callback recorded for investigation",
        });
      }

      // Safaricom STK Query remains the verification source.
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

        await recordPaymentAudit({
          payment,
          action: "MPESA_PAYMENT_CONFIRMED",
          description: "M-Pesa payment was confirmed through reconciliation.",
          metadata: {
            callbackEventId: eventId,
            paymentStatus: "COMPLETED",
            verificationMethod: "STK_QUERY",
          },
        });
      } else {
        await updateCallbackEvent(eventId, {
          processingStatus: "AWAITING_VERIFICATION",
          processingError:
            reconciliation.message ||
            "Safaricom has not yet confirmed the payment",
        });

        await recordPaymentAudit({
          payment,
          action: "MPESA_PAYMENT_REVIEW_REQUIRED",
          description: "M-Pesa payment is awaiting provider verification.",
          metadata: {
            callbackEventId: eventId,
            paymentStatus:
              reconciliation.payment?.status || "UNKNOWN",
          },
        });
      }
    } else {
      // A callback failure alone does not determine final payment status.
      const reconciliation = await reconcileMpesaPayment({
        restaurantId: payment.restaurantId,
        paymentId: payment.id,
      });

      const finalStatus = reconciliation.payment?.status;

      const confirmedFailure = ["FAILED", "REVERSED"].includes(
        finalStatus
      );

      await updateCallbackEvent(eventId, {
        processingStatus: confirmedFailure
          ? "PROCESSED"
          : "AWAITING_VERIFICATION",
        processingError: reconciliation.message || null,
      });

      if (confirmedFailure) {
        await recordPaymentAudit({
          payment,
          action: "MPESA_PAYMENT_FAILED",
          description: "M-Pesa reconciliation confirmed an unsuccessful payment.",
          metadata: {
            callbackEventId: eventId,
            paymentStatus: finalStatus,
            verificationMethod: "STK_QUERY",
          },
        });
      } else {
        await recordPaymentAudit({
          payment,
          action: "MPESA_PAYMENT_REVIEW_REQUIRED",
          description: "M-Pesa callback reported failure but final status is not confirmed.",
          metadata: {
            callbackEventId: eventId,
            paymentStatus: finalStatus || "UNKNOWN",
          },
        });
      }
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

    if (paymentForAudit) {
      await recordPaymentAudit({
        payment: paymentForAudit,
        action: "MPESA_CALLBACK_PROCESSING_ERROR",
        description: "An error occurred while processing an M-Pesa callback.",
        metadata: {
          callbackEventId: eventId || null,
          errorType: error.name || "UNKNOWN_ERROR",
        },
      });
    }

    return res.status(500).json({
      ResultCode: 1,
      ResultDesc: "Callback processing failed",
    });
  }
};
