/**
 * Shared domain types that cross the wire between the API and the two frontends.
 * Keep this minimal and provider-agnostic — no Stripe/GCP types leak in here.
 */

import type { Money } from "./money.js";

export type OrderChannel = "online" | "pos";

/** Order lifecycle — mirrors the state machine in docs/architecture.md §6.3. */
export type OrderStatus =
  | "pending_payment" // card order created, awaiting Stripe webhook
  | "awaiting_cod" // cash-on-delivery, payment collected later
  | "paid"
  | "packing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned"
  | "refunded";

export interface OrderLineDTO {
  productId: string;
  quantity: number;
  unitPrice: Money;
}

export interface OrderDTO {
  id: string;
  channel: OrderChannel;
  status: OrderStatus;
  customerId: string | null;
  lines: OrderLineDTO[];
  total: Money;
  createdAt: string;
}

export interface ProductDTO {
  id: string;
  sku: string;
  name: string;
  price: Money;
  stockOnHand: number;
}
