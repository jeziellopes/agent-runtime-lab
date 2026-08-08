/**
 * Provider retry, backoff and rate-limit handling belong here. Adapters must
 * not implement their own, and all four cells run this policy unchanged.
 */
export interface RetryPolicy {
  readonly maxRetries: number
  /** Milliseconds to wait before attempt `n`, counting from 1. */
  backoffMs(attempt: number): number
  shouldRetry(error: unknown): boolean
}

export function createRetryPolicy(_maxRetries: number): RetryPolicy {
  throw new Error('createRetryPolicy is not implemented')
}
