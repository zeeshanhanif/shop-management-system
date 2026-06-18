/**
 * Cash-on-delivery adapter (ADR-005). No gateway: the order is created in
 * `awaiting_cod`, and staff record the cash collected at delivery in the admin
 * portal, which transitions the order to `paid` and emits the receipt.
 */

import type {
  AuthorizeInput,
  AuthorizeResult,
  PaymentProvider,
  RefundInput,
} from "./payment-provider.js";

export class CashOnDeliveryProvider implements PaymentProvider {
  readonly name = "cash_on_delivery" as const;

  async authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
    // No external call. The reference is just the order id; no clientSecret.
    return { reference: `cod:${input.orderId}` };
  }

  async refund(input: RefundInput): Promise<{ reference: string }> {
    // Cash refund handed over in person and recorded by staff (audit-logged).
    return { reference: `cod-refund:${input.orderId}` };
  }
}
