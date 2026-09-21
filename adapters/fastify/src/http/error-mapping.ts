import { AgentError, RateLimitedError, RuntimeError } from '@arl/contracts'

import type { RuntimeErrorCode } from '@arl/contracts'
import type { FastifyReply } from 'fastify'

/**
 * This adapter's own copy of the error mapping. The other adapters keep their
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

export interface ErrorBody {
  error: RuntimeErrorCode
  detail: string
  retryAfter?: number
}

/**
 * The runtime normalises its own failures into a `RuntimeError` before they
 * leave it, so anything else arriving here is a defect in this adapter or a
 * refusal by the framework. It surfaces under the runtime's most general
 * identity rather than as a framework error page, because the body shape is
 * contract.
 */
export function errorHandler(error: unknown, reply: FastifyReply): void {
  const failure =
    error instanceof RuntimeError
      ? error
      : new AgentError(error instanceof Error ? error.message : String(error))
  const body: ErrorBody = { error: failure.code, detail: failure.message }

  if (failure instanceof RateLimitedError && failure.retryAfter !== undefined) {
    void reply
      .status(ERROR_STATUS[failure.code])
      .header('retry-after', String(failure.retryAfter))
      .send({ ...body, retryAfter: failure.retryAfter })

    return
  }

  void reply.status(ERROR_STATUS[failure.code]).send(body)
}
