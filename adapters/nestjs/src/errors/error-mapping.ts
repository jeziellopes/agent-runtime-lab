import type { RuntimeErrorCode } from '@arl/contracts'

/**
 * The adapter's own mapping from runtime error category to HTTP status. The
 * Hono adapter keeps its own copy; the table is never shared.
 *
 * Mid-stream failures do NOT use this table: the headers are already sent, so
 * they arrive as an `execution.failed` event.
 */
export const ERROR_STATUS: Readonly<Record<RuntimeErrorCode, number>> = {
  agent_error: 422,
  agent_not_found: 404,
  agent_already_registered: 422,
  execution_not_found: 404,
  graph_invalid: 422,
  graph_route_invalid: 422,
  max_iterations_exceeded: 422,
  fixture_not_found: 422,
  fixture_invalid: 422,
  fixture_node_required: 422,
  provider_error: 503,
  rate_limited: 429,
  tool_error: 422,
  invalid_request: 400
}

export interface ErrorBody {
  error: RuntimeErrorCode
  detail: string
  retryAfter?: number
}

export function toErrorResponse(_error: unknown): {
  status: number
  body: ErrorBody
} {
  throw new Error('toErrorResponse is not implemented')
}
