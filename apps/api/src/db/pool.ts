/**
 * Database access (see ADR-003).
 *
 * Cloud Run can run many concurrent instances, each opening connections, while
 * Postgres has a low connection ceiling. DATABASE_URL MUST point at Supabase's
 * Supavisor pooler in TRANSACTION mode (port 6543), not the direct database
 * connection. Transaction pooling means: no session-scoped state across queries
 * (avoid server-side prepared statements / LISTEN). Keep this client pool small.
 */

import pg from "pg";
import { config } from "../config.js";

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  // Small per-instance pool — the external pooler does the real multiplexing.
  max: 5,
  idleTimeoutMillis: 10_000,
});

/**
 * Run `fn` inside a single transaction. The callback receives a dedicated client;
 * a thrown error rolls back. This is the backbone of transactional integrity
 * (orders + stock + payment recorded atomically — ADR-002, ADR-006).
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
