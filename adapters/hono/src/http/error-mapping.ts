import type { RuntimeErrorCode } from '@arl/contracts'
import type { Context } from 'hono'

/**
 * This adapter's own copy of the error mapping. The NestJS adapter keeps its
 * own; the table is never shared.
 *
 * Errors converge here: handlers throw, and nothing maps a status at a return
 * site.
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

export function errorHandler(_error: Error, _context: Context): Response {
  throw new Error('errorHandler is not implemented')
}
