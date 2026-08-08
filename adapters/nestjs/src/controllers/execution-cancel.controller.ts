import { Controller, Delete, HttpCode, Inject, Param } from '@nestjs/common'

import { notImplemented } from './not-implemented.js'
import { RUNTIME } from '../providers/runtime.provider.js'

import type { NotImplementedBody } from './not-implemented.js'
import type { AgentRuntime } from '@arl/contracts'

/**
 * `DELETE /executions/:id` -> `204`, via `runtime.cancel()`.
 *
 * On cancellation the graph halts, the in-flight LLM request is aborted and
 * token billing stops. Reporting `CANCELLED` while the provider call continues
 * is a contract failure.
 */
@Controller()
export class ExecutionCancelController {
  constructor(@Inject(RUNTIME) private readonly runtime: AgentRuntime) {}

  @Delete('executions/:id')
  @HttpCode(501)
  cancel(@Param('id') _executionId: string): NotImplementedBody {
    return notImplemented('DELETE /executions/:id')
  }
}
