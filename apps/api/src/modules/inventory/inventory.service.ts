/**
 * Inventory — the authority on "can we sell this" (ADR-006).
 *
 * Overselling is prevented in the database, not in application memory. Stock rows
 * are locked with SELECT ... FOR UPDATE inside the order transaction, so two
 * simultaneous checkouts cannot both claim the last unit. The CHECK (on_hand >= 0)
 * constraint in the schema is the final backstop.
 *
 * These functions MUST be called with a transaction client (from withTransaction),
 * the same transaction that creates the order — never on a standalone connection.
 */

import type { PoolClient } from "pg";

export class OutOfStockError extends Error {
  constructor(public readonly productId: string) {
    super(`Insufficient stock for product ${productId}`);
    this.name = "OutOfStockError";
  }
}

export interface StockRequest {
  productId: string;
  quantity: number;
}

/**
 * Lock and decrement stock for every requested line, atomically. Throws
 * OutOfStockError (rolling back the whole order) if any line can't be satisfied.
 * Lock rows in a stable order (by productId) to avoid deadlocks between concurrent orders.
 */
export async function reserveStock(
  client: PoolClient,
  requests: StockRequest[],
): Promise<void> {
  const ordered = [...requests].sort((a, b) => a.productId.localeCompare(b.productId));

  for (const { productId, quantity } of ordered) {
    const { rows } = await client.query<{ on_hand: number }>(
      "SELECT on_hand FROM stock WHERE product_id = $1 FOR UPDATE",
      [productId],
    );
    const current = rows[0]?.on_hand;
    if (current === undefined || current < quantity) {
      throw new OutOfStockError(productId);
    }
    await client.query(
      "UPDATE stock SET on_hand = on_hand - $2, updated_at = now() WHERE product_id = $1",
      [productId, quantity],
    );
  }
}

/** Restore stock — used by cancellation, return, and the reservation-timeout sweep. */
export async function releaseStock(
  client: PoolClient,
  requests: StockRequest[],
): Promise<void> {
  for (const { productId, quantity } of requests) {
    await client.query(
      "UPDATE stock SET on_hand = on_hand + $2, updated_at = now() WHERE product_id = $1",
      [productId, quantity],
    );
  }
}
