import { RuntimeError } from '@arl/contracts'

const BASE_MS = 100
const CEILING_MS = 2000

/**
 * Provider retry, backoff and rate-limit handling belong here. Adapters must
 * not implement their own, and all four cells run this policy unchanged.
 *
 * Putting retry in the adapter would make it a framework variable and bias
 * every latency number the study reports.
 */
export interface RetryPolicy {
  readonly maxRetries: number
  /** Milliseconds to wait before attempt `n`, counting from 1. */
  backoffMs(attempt: number): number
  shouldRetry(error: unknown): boolean
}

export function createRetryPolicy(maxRetries: number): RetryPolicy {
  return {
    maxRetries,

    backoffMs: attempt => Math.min(BASE_MS * 2 ** (attempt - 1), CEILING_MS),

    /**
     * Provider-category only. Retrying an agent- or tool-category failure would
     * repeat a defect rather than wait out an outage.
     */
    shouldRetry: error =>
      error instanceof RuntimeError && error.category === 'provider'
  }
}
