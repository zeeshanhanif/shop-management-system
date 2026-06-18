/**
 * Payment provider abstraction (ADR-005).
 *
 * Order logic depends ONLY on this interface — never on Stripe or COD directly —
 * so a future regional gateway plugs in without touching order code. Note the
 * interface is honest about card payments being asynchronous and webhook-confirmed:
 * `authorize` does not mean "money captured", it means "the customer can now pay".
 */

import type { Money } from "@shop/shared";

export interface AuthorizeInput {
  orderId: string;
  amount: Money;
}

export interface AuthorizeResult {
  /** Card providers return a secret the frontend uses to confirm payment. */
  clientSecret?: string;
  /** Provider-side reference (e.g. Stripe PaymentIntent id). */
  reference: string;
}

export interface RefundInput {
  orderId: string;
  amount: Money;
  reference: string;
}

export interface PaymentProvider {
  readonly name: "stripe" | "cash_on_delivery";

  /** Begin payment. For cards this creates an intent; for COD it's a no-op marker. */
  authorize(input: AuthorizeInput): Promise<AuthorizeResult>;

  /** Reverse a payment. For cards this calls the gateway; for COD it's recorded by staff. */
  refund(input: RefundInput): Promise<{ reference: string }>;
}
