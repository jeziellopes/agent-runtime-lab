/**
 * Errors are categorized, and the category decides the HTTP mapping. All four
 * cells must produce the same category for the same failure.
 *
 * The mapping from category to status lives in each adapter, never here.
 */
export type ErrorCategory = 'agent' | 'provider' | 'tool' | 'validation'

export type RuntimeErrorCode =
  | 'agent_error'
  | 'agent_not_found'
  | 'provider_error'
  | 'rate_limited'
  | 'tool_error'
  | 'invalid_request'

export abstract class RuntimeError extends Error {
  abstract readonly category: ErrorCategory

  abstract readonly code: RuntimeErrorCode

  constructor(public readonly detail: string) {
    super(detail)
    this.name = new.target.name
  }
}

/** Invalid graph, invalid state, node failure. Not retried. */
export class AgentError extends RuntimeError {
  readonly category = 'agent'

  readonly code = 'agent_error'
}

export class AgentNotFoundError extends RuntimeError {
  readonly category = 'agent'

  readonly code = 'agent_not_found'
}

/** Timeout or unavailable. Retried by the runtime, never by the adapter. */
export class ProviderError extends RuntimeError {
  readonly category = 'provider'

  readonly code = 'provider_error'
}

/**
 * Raised only once the runtime's own backoff is exhausted. Retry policy belongs
 * to the runtime; adapters must not implement their own.
 */
export class RateLimitedError extends RuntimeError {
  readonly category = 'provider'

  readonly code = 'rate_limited'

  constructor(
    detail: string,
    public readonly retryAfter?: number
  ) {
    super(detail)
  }
}

/** Execution failure or invalid tool input. Not retried. */
export class ToolError extends RuntimeError {
  readonly category = 'tool'

  readonly code = 'tool_error'
}

/** Malformed request, raised at the adapter boundary. */
export class ValidationError extends RuntimeError {
  readonly category = 'validation'

  readonly code = 'invalid_request'
}
