/**
 * Errors are categorized, and the category decides the HTTP mapping. All four
 * cells must produce the same category for the same failure.
 *
 * The mapping from category to status lives in each adapter, never here.
 */
export type ErrorCategory = 'agent' | 'provider' | 'tool' | 'validation'

/**
 * The identity a caller branches on and a test asserts. Status is keyed by
 * code rather than by category: `agent_not_found` and `agent_error` are both
 * agent-category and map to different statuses.
 */
export type RuntimeErrorCode =
  | 'agent_error'
  | 'agent_not_found'
  | 'agent_already_registered'
  | 'execution_not_found'
  | 'graph_invalid'
  | 'graph_route_invalid'
  | 'max_iterations_exceeded'
  | 'fixture_not_found'
  | 'fixture_invalid'
  | 'fixture_node_required'
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

/** Registration, at boot. A malformed cell must not start. */
export class AgentAlreadyRegisteredError extends RuntimeError {
  readonly category = 'agent'

  readonly code = 'agent_already_registered'
}

/** Raised by the adapter when `getExecution` resolves `null`. */
export class ExecutionNotFoundError extends RuntimeError {
  readonly category = 'agent'

  readonly code = 'execution_not_found'
}

/** Compile-time graph validation. Raised before any request runs. */
export class GraphInvalidError extends RuntimeError {
  readonly category = 'agent'

  readonly code = 'graph_invalid'
}

/** A `nextNode` matching no outgoing edge, or an absent one where a branch was required. */
export class GraphRouteInvalidError extends RuntimeError {
  readonly category = 'agent'

  readonly code = 'graph_route_invalid'
}

export class MaxIterationsExceededError extends RuntimeError {
  readonly category = 'agent'

  readonly code = 'max_iterations_exceeded'
}

/** No fixture for the pair, or none for the node the request named. */
export class FixtureNotFoundError extends RuntimeError {
  readonly category = 'agent'

  readonly code = 'fixture_not_found'
}

/** Malformed at load: a duplicate key, a missing field, an empty model. */
export class FixtureInvalidError extends RuntimeError {
  readonly category = 'agent'

  readonly code = 'fixture_invalid'
}

/** A multi-call fixture reached without a `nodeId` to select against. */
export class FixtureNodeRequiredError extends RuntimeError {
  readonly category = 'agent'

  readonly code = 'fixture_node_required'
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
