import { AgentError, RateLimitedError, RuntimeError } from '@arl/contracts'

import type { RuntimeErrorCode } from '@arl/contracts'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * This adapter's own copy of the error mapping. The NestJS adapter keeps its
 * own; the table is never shared.
 *
 * Errors converge here: handlers throw, and nothing maps a status at a return
 * site.
 */
export const ERROR_STATUS: Readonly<
  Record<RuntimeErrorCode, ContentfulStatusCode>
> = {
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

/**
 * The runtime normalises its own failures into a `RuntimeError` before they
 * leave it, so anything else arriving here is a defect in this adapter. It
 * surfaces under the runtime's most general identity rather than as a framework
 * error page, because the body shape is contract and an HTML 500 is not one.
 */
export function errorHandler(error: Error, context: Context): Response {
  const failure =
    error instanceof RuntimeError ? error : new AgentError(error.message)
  const body: ErrorBody = { error: failure.code, detail: failure.message }

  if (failure instanceof RateLimitedError && failure.retryAfter !== undefined) {
    return context.json(
      { ...body, retryAfter: failure.retryAfter },
      ERROR_STATUS[failure.code],
      { 'retry-after': String(failure.retryAfter) }
    )
  }

  return context.json(body, ERROR_STATUS[failure.code])
}
