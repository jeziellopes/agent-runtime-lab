import { Controller, Delete, HttpCode, Inject, Param } from '@nestjs/common'

import { RUNTIME } from '../providers/runtime.provider.js'

import type { AgentRuntime } from '@arl/contracts'

/**
 * `DELETE /executions/:id` -> `204`, via `runtime.cancel()`.
 *
 * On cancellation the graph halts, the in-flight LLM request is aborted and
 * token billing stops. Reporting `CANCELLED` while the provider call continues
 * is a contract failure.
 *
 * `204` for a running execution, an already-terminal one and an id that never
 * existed alike: reporting the difference would leak execution existence
 * through a status code.
 */
@Controller()
export class ExecutionCancelController {
  constructor(@Inject(RUNTIME) private readonly runtime: AgentRuntime) {}

  @Delete('executions/:id')
  @HttpCode(204)
  cancel(@Param('id') executionId: string): Promise<void> {
    return this.runtime.cancel(executionId)
  }
}
