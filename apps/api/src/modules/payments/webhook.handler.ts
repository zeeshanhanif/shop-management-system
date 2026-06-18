/**
 * Stripe webhook handler — the AUTHORITATIVE "payment succeeded" signal (§6.1).
 *
 * Two non-negotiables (ADR-005):
 *  1. Verify the Stripe signature before trusting anything.
 *  2. Be idempotent on the Stripe event id: the UNIQUE (provider, provider_event)
 *     constraint on payment_events means a redelivered webhook is a harmless no-op,
 *     never a double-paid order or duplicate receipt.
 */

import { withTransaction } from "../../db/pool.js";

export interface StripeEvent {
  id: string;
  type: string;
  orderId: string;
  amountMinor: number;
  currency: string;
}

export async function handlePaymentSucceeded(event: StripeEvent): Promise<void> {
  await withTransaction(async (client) => {
    // Insert the event first; if it already exists, the unique constraint trips and
    // we stop — the order was already marked paid by the first delivery.
    const inserted = await client.query(
      `INSERT INTO payment_events (order_id, provider, provider_event, kind, amount_minor, currency)
       VALUES ($1, 'stripe', $2, 'paid', $3, $4)
       ON CONFLICT (provider, provider_event) DO NOTHING`,
      [event.orderId, event.id, event.amountMinor, event.currency],
    );
    if (inserted.rowCount === 0) return; // duplicate delivery — already processed

    await client.query(
      `UPDATE orders SET status = 'paid', reserved_until = NULL
       WHERE id = $1 AND status = 'pending_payment'`,
      [event.orderId],
    );

    // TODO: enqueue "send confirmation email" via Cloud Tasks (ADR-004) — outside
    // the hot path, with retries, so a flaky email provider never blocks payment.
  });
}
