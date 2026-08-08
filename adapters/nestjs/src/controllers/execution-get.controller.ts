import { Controller, Get, HttpCode, Inject, Param } from '@nestjs/common'

import { notImplemented } from './not-implemented.js'
import { RUNTIME } from '../providers/runtime.provider.js'

import type { NotImplementedBody } from './not-implemented.js'
import type { AgentRuntime } from '@arl/contracts'

/** `GET /executions/:id` -> `Execution`, via `runtime.getExecution()`. */
@Controller()
export class ExecutionGetController {
  constructor(@Inject(RUNTIME) private readonly runtime: AgentRuntime) {}

  @Get('executions/:id')
  @HttpCode(501)
  get(@Param('id') _executionId: string): NotImplementedBody {
    return notImplemented('GET /executions/:id')
  }
}
