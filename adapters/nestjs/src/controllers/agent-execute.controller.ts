import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common'

import { ExecutionRequestPipe } from '../pipes/execution-request.pipe.js'
import { RUNTIME } from '../providers/runtime.provider.js'

import type { ExecutionBody } from '../pipes/execution-request.pipe.js'
import type { AgentRuntime, ExecutionResult } from '@arl/contracts'

/** `POST /agents/:id/execute` -> `ExecutionResult`, via `runtime.execute()`. */
@Controller()
export class AgentExecuteController {
  constructor(@Inject(RUNTIME) private readonly runtime: AgentRuntime) {}

  /* 200, not the framework's 201 for a POST: the response carries the result of
     an execution rather than the location of a new resource. */
  @Post('agents/:id/execute')
  @HttpCode(200)
  execute(
    @Param('id') agentId: string,
    @Body(ExecutionRequestPipe) body: ExecutionBody
  ): Promise<ExecutionResult> {
    return this.runtime.execute({ agentId, ...body })
  }
}
