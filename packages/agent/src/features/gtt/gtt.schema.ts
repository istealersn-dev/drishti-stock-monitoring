import { z } from "zod";

export const GttCreateRequestSchema = z.object({
  transaction_type: z.enum(["BUY", "SELL"]),
  trading_symbol: z.string().min(1),
  exchange: z.string().min(1),
  instrument_token: z.string().min(1),
  product: z.string().min(1),
  quantity: z.number().int().positive(),
  order_type: z.literal("LIMIT"),
  trigger_price: z.number().positive(),
  limit_price: z.number().positive(),
});

export type GttCreateRequest = z.infer<typeof GttCreateRequestSchema>;

export const GttCreateResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    order_id: z.string(),
  }),
});

export type GttCreateResponse = z.infer<typeof GttCreateResponseSchema>;

export const GttOrderSchema = z.object({
  order_id: z.string(),
  trading_symbol: z.string(),
  exchange: z.string(),
  instrument_token: z.string(),
  transaction_type: z.string(),
  quantity: z.number(),
  product: z.string(),
  order_type: z.string(),
  trigger_price: z.number(),
  limit_price: z.number(),
  status: z.string(),
});

export type GttOrder = z.infer<typeof GttOrderSchema>;

export const GttListResponseSchema = z.object({
  status: z.string(),
  data: z.array(GttOrderSchema),
});

export const GttCancelResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    order_id: z.string(),
  }),
});
