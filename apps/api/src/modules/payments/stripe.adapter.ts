/**
 * Stripe adapter (ADR-005). Card data never touches our servers — the frontend
 * confirms the PaymentIntent with Stripe directly using the returned clientSecret.
 * The authoritative "paid" signal arrives via webhook, handled in webhook.handler.ts.
 *
 * Scaffold: method shapes are real; the Stripe SDK call sites are marked TODO.
 */

import type {
  AuthorizeInput,
  AuthorizeResult,
  PaymentProvider,
  RefundInput,
} from "./payment-provider.js";

export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe" as const;

  // constructor(private readonly stripe: Stripe) {}

  async authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
    // TODO: const intent = await this.stripe.paymentIntents.create({
    //   amount: input.amount.minorUnits,
    //   currency: input.amount.currency.toLowerCase(),
    //   metadata: { orderId: input.orderId },
    //   idempotencyKey: input.orderId,   // safe to retry
    // });
    // return { clientSecret: intent.client_secret!, reference: intent.id };
    throw new Error("StripePaymentProvider.authorize not yet implemented");
  }

  async refund(input: RefundInput): Promise<{ reference: string }> {
    // TODO: const refund = await this.stripe.refunds.create({
    //   payment_intent: input.reference,
    //   amount: input.amount.minorUnits,
    // });
    // return { reference: refund.id };
    throw new Error("StripePaymentProvider.refund not yet implemented");
  }
}
