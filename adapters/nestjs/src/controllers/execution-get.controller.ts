import { Controller, Get, Inject, Param } from '@nestjs/common'
import { ExecutionNotFoundError } from '@arl/contracts'

import { RUNTIME } from '../providers/runtime.provider.js'

import type { AgentRuntime, Execution } from '@arl/contracts'

/** `GET /executions/:id` -> `Execution`, via `runtime.getExecution()`. */
@Controller()
export class ExecutionGetController {
  constructor(@Inject(RUNTIME) private readonly runtime: AgentRuntime) {}

  @Get('executions/:id')
  async get(@Param('id') executionId: string): Promise<Execution> {
    const execution = await this.runtime.getExecution(executionId)

    if (execution === null) {
      throw new ExecutionNotFoundError(`no execution ${executionId}`)
    }

    return execution
  }
}
