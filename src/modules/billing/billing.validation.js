import { z } from "zod";

export const sessionIdParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

export const billIdParamsSchema = z.object({
  billId: z.string().uuid(),
});

export const listBillsQuerySchema = z.object({
  status: z.enum([
    "OPEN",
    "PARTIALLY_PAID",
    "PAID",
    "VOIDED",
  ]).optional(),

  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const splitBillSchema=z.object({
  items:z.array(
    z.object({
      orderItemId:z.string().uuid(),
      quantity:z.number().int().min(1),
    })
  ).min(1),
}).superRefine((data,ctx)=>{
  const ids=data.items.map((item)=>item.orderItemId);

  if(new Set(ids).size !== ids.length){
    ctx.addIssue({
      code:"custom",
      message:"Each order item can only appear once.",
      path:["items"],
    })
  }
})
export const createPaymentSchema = z.object({
  method: z.enum([
    "CASH",
    "CARD",
    "BANK_TRANSFER",
  ]),

  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid monetary amount")
    .refine((value) => Number(value) > 0, {
      message: "Payment amount must be greater than zero",
    }),

  idempotencyKey: z.string().min(16).max(100),

  reference: z.string().max(100).optional(),
});