/**
 * Money — exact currency arithmetic in integer minor units (see ADR-009).
 *
 * The whole point of this system is to never miscount money, so floating point
 * is banned. A `Money` value holds an integer number of minor units (e.g. cents)
 * plus an ISO-4217 currency code. All math stays in integer space; conversion to
 * a human-readable decimal happens only at the display edge.
 *
 * This mirrors how Stripe represents amounts, so values cross the payment
 * boundary without a lossy conversion.
 */

export type CurrencyCode = string; // ISO-4217, e.g. "USD", "PKR", "EUR"

export interface Money {
  /** Integer amount in the currency's smallest unit (cents, paisa, …). */
  readonly minorUnits: number;
  readonly currency: CurrencyCode;
}

export function money(minorUnits: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(minorUnits)) {
    throw new Error(`Money must be whole minor units, got ${minorUnits}`);
  }
  return { minorUnits, currency };
}

export function zero(currency: CurrencyCode): Money {
  return { minorUnits: 0, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minorUnits + b.minorUnits, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minorUnits - b.minorUnits, a.currency);
}

/** Multiply by an integer quantity (e.g. line item: unit price × qty). */
export function multiply(a: Money, quantity: number): Money {
  if (!Number.isInteger(quantity)) {
    throw new Error(`Quantity must be an integer, got ${quantity}`);
  }
  return money(a.minorUnits * quantity, a.currency);
}

export function isNegative(a: Money): boolean {
  return a.minorUnits < 0;
}

/** Display formatting — the ONLY place decimals appear. */
export function format(a: Money, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: a.currency,
  }).format(a.minorUnits / 100);
}
