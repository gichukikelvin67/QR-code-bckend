import prisma from "../../config/database.js";
import { initiateDarajaStkPush,queryDarajaStkPush } from "./daraja.service.js";



export const reconcileMpesaPayment = async ({
  restaurantId,
  paymentId,
}) => {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      restaurantId,
      method: "MPESA",
    },
  });

  if (!payment) {
    throw createError("M-Pesa payment not found", 404);
  }

  if (!payment.checkoutRequestId || !payment.darajaTimestamp) {
    throw createError(
      "This payment does not have the required STK Query details",
      409
    );
  }

  if (["COMPLETED", "FAILED", "REVERSED"].includes(payment.status)) {
    return {
      payment,
      reconciled: false,
      message: "Payment already has a final status",
    };
  }

  // Query Safaricom outside the database transaction.
  const result = await queryDarajaStkPush({
    checkoutRequestId: payment.checkoutRequestId,
    timestamp: payment.darajaTimestamp,
  });

  // ResponseCode confirms whether the query request was accepted.
  if (String(result.ResponseCode) !== "0") {
    return {
      payment,
      reconciled: false,
      providerResponse: result,
      message: "Safaricom did not accept the status query",
    };
  }

  const resultCode =
    result.ResultCode === undefined
      ? null
      : String(result.ResultCode);

  if (resultCode === null) {
    return {
      payment,
      reconciled: false,
      providerResponse: result,
      message: "Payment is awaiting a final result",
    };
  }

  // Safaricom confirmed successful payment.
  if (resultCode === "0") {
    let updated;

    // Retry serialization conflicts without querying Safaricom again.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        updated = await prisma.$transaction(
          async (tx) => {
            const current = await tx.payment.findFirst({
              where: {
                id: paymentId,
                restaurantId,
              },
            });

            if (
              !current ||
              !["PENDING", "PROCESSING"].includes(current.status)
            ) {
              return current;
            }

            const bill = await tx.bill.findFirst({
              where: {
                id: current.billId,
                restaurantId,
              },
            });

            if (!bill) {
              throw createError("Associated bill not found", 404);
            }

            const paidCents = toCents(bill.amountPaid);
            const totalCents = toCents(bill.total);
            const paymentCents = toCents(current.amount);

            const newPaidCents = paidCents + paymentCents;

            if (newPaidCents > totalCents) {
              throw createError(
                "Confirmed payment would exceed the bill total",
                409
              );
            }

            const newBalanceCents = totalCents - newPaidCents;

            const paymentUpdate = await tx.payment.updateMany({
              where: {
                id: current.id,
                status: {
                  in: ["PENDING", "PROCESSING"],
                },
              },
              data: {
                status: "COMPLETED",
                reference: current.checkoutRequestId,
                verifiedAt: new Date(),
              },
            });

            // Only the transaction that changes the payment
            // is allowed to update the bill balance.
            if (paymentUpdate.count === 1) {
              await tx.bill.update({
                where: {
                  id: bill.id,
                },
                data: {
                  amountPaid: formatMoney(newPaidCents),
                  balance: formatMoney(newBalanceCents),
                  status:
                    newBalanceCents === 0n
                      ? "PAID"
                      : "PARTIALLY_PAID",
                },
              });
            }

            return tx.payment.findUnique({
              where: {
                id: current.id,
              },
            });
          },
          {
            isolationLevel: "Serializable",
          }
        );

        break;
      } catch (error) {
        if (error.code === "P2034" && attempt < 3) {
          continue;
        }

        throw error;
      }
    }

    return {
      payment: updated,
      reconciled: updated?.status === "COMPLETED",
      providerResponse: result,
    };
  }

  // Known cancellation and timeout results.
  if (["1032", "1037"].includes(resultCode)) {
    const updated = await prisma.payment.updateMany({
      where: {
        id: paymentId,
        restaurantId,
        status: {
          in: ["PENDING", "PROCESSING"],
        },
      },
      data: {
        status: "FAILED",
        failureReason:
          result.ResultDesc || "M-Pesa request failed",
      },
    });

    return {
      payment: await prisma.payment.findFirst({
        where: {
          id: paymentId,
          restaurantId,
        },
      }),
      reconciled: updated.count === 1,
      providerResponse: result,
    };
  }

  // Never guess the outcome of an unfamiliar provider result.
  return {
    payment,
    reconciled: false,
    providerResponse: result,
    message:
      "Unrecognized result. Payment remains pending for investigation.",
  };
};



const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toCents = (value) => {
  const [whole, fraction = ""] = String(value).split(".");
  return (
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"))
  );
};

const formatMoney = (cents) => {
  const whole = cents / 100n;
  const fraction = String(cents % 100n).padStart(2, "0");

  return `${whole}.${fraction}`;
};

const normalizeKenyanPhone = (phone) => {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("0")) {
    return `254${digits.slice(1)}`;
  }

  if (digits.startsWith("254")) {
    return digits;
  }

  throw createError("Invalid Kenyan phone number", 400);
};

export const initiateMpesaPayment = async ({
  restaurantId,
  billId,
  phoneNumber,
  amount,
  idempotencyKey,
}) => {
  const phone = normalizeKenyanPhone(phoneNumber);
  const amountCents = toCents(amount);

  if (amountCents <= 0n || amountCents % 100n !== 0n) {
    throw createError(
      "M-Pesa amount must be a positive whole KES amount",
      400
    );
  }

  let payment;

  try {
    const reservation = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.payment.findUnique({
          where: {
            restaurantId_idempotencyKey: {
              restaurantId,
              idempotencyKey,
            },
          },
          include: {
            bill: true,
          },
        });

        if (existing) {
          if (
            existing.billId !== billId ||
            existing.method !== "MPESA" ||
            toCents(existing.amount) !== amountCents ||
            existing.phoneNumber !== phone
          ) {
            throw createError(
              "This idempotency key was already used for another payment",
              409
            );
          }

          return {
            payment: existing,
            duplicate: true,
          };
        }

        const bill = await tx.bill.findFirst({
          where: {
            id: billId,
            restaurantId,
          },
        });

        if (!bill) {
          throw createError("Bill not found", 404);
        }

        if (["PAID", "VOIDED"].includes(bill.status)) {
          throw createError(
            "This bill cannot accept payments",
            409
          );
        }

        const pending = await tx.payment.aggregate({
          where: {
            restaurantId,
            billId,
            status: {
              in: ["PENDING", "PROCESSING"],
            },
          },
          _sum: {
            amount: true,
          },
        });

        const reservedCents = toCents(
          pending._sum.amount ?? "0"
        );

        const availableCents =
          toCents(bill.total) -
          toCents(bill.amountPaid) -
          reservedCents;

        if (amountCents > availableCents) {
          throw createError(
            "Payment exceeds the available bill balance",
            409
          );
        }

        const created = await tx.payment.create({
          data: {
            restaurantId,
            billId,
            method: "MPESA",
            status: "PENDING",
            amount: formatMoney(amountCents),
            idempotencyKey,
            phoneNumber: phone,
          },
        });

        return {
          payment: created,
          duplicate: false,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );

    payment = reservation.payment;

    if (reservation.duplicate) {
      return {
        payment,
        duplicate: true,
        message: "Existing payment request returned",
      };
    }
  } catch (error) {
    if (error.code === "P2034") {
      throw createError(
        "The bill changed during payment initiation. Retry using the same idempotency key.",
        409
      );
    }

    throw error;
  }

  // Send the STK request only after the pending payment is saved.
  try {
    const accountReference = payment.id.slice(0, 12);

    const stkResponse = await initiateDarajaStkPush({
      phoneNumber: phone,
      amount: Number(amountCents / 100n),
      accountReference,
    });
  const updatedPayment = await prisma.payment.update({
  where: {
    id: payment.id,
  },
  data: {
    status: "PROCESSING",
    checkoutRequestId: stkResponse.CheckoutRequestID,
    merchantRequestId: stkResponse.MerchantRequestID,
    darajaTimestamp: stkResponse.requestTimestamp,
    reference: stkResponse.ResponseCode,
  },
});
    return {
      payment: updatedPayment,
      duplicate: false,
      stk: {
        merchantRequestId: stkResponse.MerchantRequestID,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        responseDescription: stkResponse.ResponseDescription,
        customerMessage: stkResponse.CustomerMessage,
      },
    };
  } catch (error) {
    // A clear Safaricom rejection can be marked failed.
    // A network timeout is ambiguous, so leave it pending for reconciliation.
    if (error.darajaRejected) {
      await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "FAILED",
          failureReason: error.message,
        },
      });

      throw createError(error.message, 502);
    }

    await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        failureReason:
          "STK request outcome is uncertain. Await reconciliation before retrying.",
      },
    });

    throw createError(
      "Unable to confirm the STK Push request. Check the payment status before starting another attempt.",
      503
    );
  }
};


export const getMpesaPaymentStatus = async ({
  restaurantId,
  paymentId,
}) => {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      restaurantId,
      method: "MPESA",
    },
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      phoneNumber: true,
      reference: true,
      checkoutRequestId: true,
      failureReason: true,
      verifiedAt: true,
      createdAt: true,
      updatedAt: true,
      bill: {
        select: {
          id: true,
          billNumber: true,
          status: true,
          total: true,
          amountPaid: true,
          balance: true,
        },
      },
    },
  });

  if (!payment) {
    const error = new Error("M-Pesa payment not found");
    error.statusCode = 404;
    throw error;
  }

  return payment;
};
