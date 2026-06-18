/**
 * Orders — placing an order is the system's most important operation, so it is a
 * single ACID transaction: reserve stock + create the order atomically (§6.1).
 *
 * Payment is handled AFTER the stock-reserving transaction commits:
 *  - card  -> create a Stripe PaymentIntent; the order is only marked `paid` later,
 *             when the webhook arrives (never trust the client). Status: pending_payment.
 *  - cod   -> no gateway call; status: awaiting_cod, settled by staff on delivery.
 *
 * This file is a scaffold: the shape and the guarantees are real, the wiring to
 * the HTTP layer and the live payment provider is stubbed where marked TODO.
 */

import { withTransaction } from "../../db/pool.js";
import { reserveStock, type StockRequest } from "../inventory/inventory.service.js";
import type { PaymentProvider } from "../payments/payment-provider.js";
import { add, multiply, money, type Money } from "@shop/shared";

export interface PlaceOrderInput {
  channel: "online" | "pos";
  customerId: string | null;
  paymentMethod: "card" | "cash_on_delivery";
  lines: Array<{ productId: string; quantity: number; unitPrice: Money }>;
  /** Client-supplied; makes a retried request a no-op instead of a duplicate order. */
  idempotencyKey: string;
}

export interface PlaceOrderResult {
  orderId: string;
  status: string;
  /** Present for card payments — the frontend confirms the PaymentIntent with this. */
  clientSecret?: string;
}

function computeTotal(lines: PlaceOrderInput["lines"]): Money {
  if (lines.length === 0) throw new Error("Order must have at least one line");
  const currency = lines[0]!.unitPrice.currency;
  return lines.reduce(
    (sum, l) => add(sum, multiply(l.unitPrice, l.quantity)),
    money(0, currency),
  );
}

export async function placeOrder(
  input: PlaceOrderInput,
  payments: PaymentProvider,
): Promise<PlaceOrderResult> {
  const total = computeTotal(input.lines);
  const stockRequests: StockRequest[] = input.lines.map((l) => ({
    productId: l.productId,
    quantity: l.quantity,
  }));

  // 1) Reserve stock + create order atomically. Throws OutOfStockError -> 409.
  const initialStatus =
    input.paymentMethod === "cash_on_delivery" ? "awaiting_cod" : "pending_payment";

  const orderId = await withTransaction(async (client) => {
    // TODO: short-circuit and return the existing order if idempotencyKey already used.
    await reserveStock(client, stockRequests);

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO orders (channel, status, customer_id, total_minor, currency, idempotency_key, reserved_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.channel,
        initialStatus,
        input.customerId,
        total.minorUnits,
        total.currency,
        input.idempotencyKey,
        input.paymentMethod === "card" ? reservationDeadline() : null,
      ],
    );
    const id = rows[0]!.id;

    // TODO: insert order_lines rows here within the same transaction.
    return id;
  });

  // 2) Kick off payment OUTSIDE the stock transaction (external call, may be slow).
  if (input.paymentMethod === "card") {
    const intent = await payments.authorize({ orderId, amount: total });
    return { orderId, status: initialStatus, clientSecret: intent.clientSecret };
  }

  return { orderId, status: initialStatus };
}

function reservationDeadline(): Date {
  const minutes = Number(process.env.RESERVATION_TIMEOUT_MINUTES ?? 30);
  return new Date(Date.now() + minutes * 60_000);
}
