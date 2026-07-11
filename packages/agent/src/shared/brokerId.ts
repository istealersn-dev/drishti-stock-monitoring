import { z } from "zod";

export const BROKER_IDS = ["upstox", "groww"] as const;
export const BrokerIdSchema = z.enum(BROKER_IDS);
export type BrokerId = z.infer<typeof BrokerIdSchema>;
