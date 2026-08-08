import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common'

import { notImplemented } from './not-implemented.js'
import { RUNTIME } from '../providers/runtime.provider.js'

import type { NotImplementedBody } from './not-implemented.js'
import type { AgentRuntime } from '@arl/contracts'

export interface ExecuteBody {
  input: unknown
  sessionId?: string
}

/** `POST /agents/:id/execute` -> `ExecutionResult`, via `runtime.execute()`. */
@Controller()
export class AgentExecuteController {
  constructor(@Inject(RUNTIME) private readonly runtime: AgentRuntime) {}

  @Post('agents/:id/execute')
  @HttpCode(501)
  execute(
    @Param('id') _agentId: string,
    @Body() _body: ExecuteBody
  ): NotImplementedBody {
    return notImplemented('POST /agents/:id/execute')
  }
}
