/**
 * Async job queue port (ADR-004). Implemented by a Cloud Tasks adapter that pushes
 * the job back to this API over HTTPS — no standing broker, no separate worker.
 * Domain code depends on this interface, keeping the GCP coupling at the edge.
 */

export interface JobQueue {
  /** Enqueue a named job with a JSON-serialisable payload for later HTTP delivery. */
  enqueue(jobType: string, payload: Record<string, unknown>): Promise<void>;
}
