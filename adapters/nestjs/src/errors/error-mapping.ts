import { HttpException } from '@nestjs/common'
import {
  AgentError,
  RateLimitedError,
  RuntimeError,
  ValidationError
} from '@arl/contracts'

import type { RuntimeErrorCode } from '@arl/contracts'

/**
 * The adapter's own mapping from runtime error code to HTTP status. The Hono
 * adapter keeps its own copy; the table is never shared.
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

export interface ErrorResponse {
  status: number
  body: ErrorBody
  headers: Record<string, string>
}

/**
 * `undefined` means this adapter does not own the failure, and the framework's
 * own handling stands: an unmatched route is the framework answering about its
 * own routing table, not the runtime answering about an agent.
 *
 * Everything else it does own. The runtime normalises its failures into a
 * `RuntimeError` before they leave it, so anything unrecognised here is a defect
 * in this adapter, and it surfaces under the runtime's most general identity
 * rather than as a framework error page.
 */
export function toErrorResponse(error: unknown): ErrorResponse | undefined {
  if (error instanceof RuntimeError) {
    return responseFor(error)
  }

  /* A body the framework could not parse arrives as its own 400, before any
     handler ran. It is still a client error and it still owes the two keys. */
  if (error instanceof HttpException) {
    return error.getStatus() === 400
      ? responseFor(new ValidationError(error.message))
      : undefined
  }

  return responseFor(
    new AgentError(error instanceof Error ? error.message : String(error))
  )
}

function responseFor(failure: RuntimeError): ErrorResponse {
  const body: ErrorBody = { error: failure.code, detail: failure.message }

  if (failure instanceof RateLimitedError && failure.retryAfter !== undefined) {
    return {
      status: ERROR_STATUS[failure.code],
      body: { ...body, retryAfter: failure.retryAfter },
      headers: { 'retry-after': String(failure.retryAfter) }
    }
  }

  return { status: ERROR_STATUS[failure.code], body, headers: {} }
}
