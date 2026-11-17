import {env}from "../../config/env.js";

const DARAJA_BASE_URL=
env.DARAJA_ENV=== "production"
?"https://api.safaricom.co.ke"
: "https://sandbox.safaricom.co.ke";

let cachedAccessToken=null;
let tokenExpiresAt=0;

export const getDarajaAccessToken=async()=>{
    //Reuse the token until shortly before it expires
    if(
        cachedAccessToken&&
        Date.now()< tokenExpiresAt
    ){
        return cachedAccessToken;
    }
    const credentials=Buffer.from(
        `${env.DARAJA_CONSUMER_KEY}:${env.DARAJA_CONSUMER_SECRET}`
    ).toString("base64");

    let response;
    try{
        response=await fetch(
            `${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
            {
                method:"GET",
                headers:{
                    Authorization:`Basic ${credentials}`,
                },
                signal:AbortSignal.timeout(15000),
            }
        );
    }catch(error){
        throw new Error(
            `Daraja authentication request failed:${error.message}`
        );
    }

    const data=await response.json();
    if(!response.ok || !data.access_token){
        throw new Error(
            data.errorMessage ||
            data.error_description ||
            "Unable to obtain Daraja access token"
        );
    }
    const expiresIn=Number(data.expires_in ||3599)
    cachedAccessToken=data.access_token;

    //Refresh the token 60 seconds before it expiry.
    tokenExpiresAt=
    Date.now()+ Math.max(expiresIn -60,0) * 1000;

    return cachedAccessToken;
};

export const generateDarajaPassword = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  const timestamp =
    `${values.year}${values.month}${values.day}` +
    `${values.hour}${values.minute}${values.second}`;

  const password = Buffer.from(
    `${env.DARAJA_SHORTCODE}${env.DARAJA_PASSKEY}${timestamp}`
  ).toString("base64");

  return { password, timestamp };
};

export const initiateDarajaStkPush = async ({
  phoneNumber,
  amount,
  accountReference,
}) => {
  const accessToken = await getDarajaAccessToken();
  const { password, timestamp } = generateDarajaPassword();

  const response = await fetch(
    `${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: env.DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: env.DARAJA_TRANSACTION_TYPE,
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: env.DARAJA_SHORTCODE,
        PhoneNumber: phoneNumber,
        CallBackURL: env.DARAJA_CALLBACK_URL,
        AccountReference: accountReference,
        TransactionDesc: "Restaurant bill payment",
      }),
      signal: AbortSignal.timeout(20000),
    }
  );

  const data = await response.json();

  if (!response.ok || data.ResponseCode !== "0") {
    const error = new Error(
      data.errorMessage ||
      data.ResponseDescription ||
      "Safaricom rejected the STK Push request"
    );

    error.darajaRejected = true;
    throw error;
  }

  return data;
};

export const queryDarajaStkPush = async ({
  checkoutRequestId,
  timestamp,
}) => {
  if (!checkoutRequestId || !timestamp) {
    throw new Error("Checkout request ID and timestamp are required");
  }

  const accessToken = await getDarajaAccessToken();

  const password = generateDarajaPassword(timestamp);

  const response = await fetch(
    `${DARAJA_BASE_URL}/mpesa/stkpushquery/v1/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: env.DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.errorMessage || "Failed to query M-Pesa STK Push"
    );
  }

  return data;
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
