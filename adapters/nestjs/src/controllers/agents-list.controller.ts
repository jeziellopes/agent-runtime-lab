import { Controller, Get, HttpCode, Inject } from '@nestjs/common'

import { notImplemented } from './not-implemented.js'
import { RUNTIME } from '../providers/runtime.provider.js'

import type { NotImplementedBody } from './not-implemented.js'
import type { AgentRuntime } from '@arl/contracts'

/** `GET /agents` -> `AgentDefinition[]`, via `runtime.listAgents()`. */
@Controller()
export class AgentsListController {
  constructor(@Inject(RUNTIME) private readonly runtime: AgentRuntime) {}

  @Get('agents')
  @HttpCode(501)
  list(): NotImplementedBody {
    return notImplemented('GET /agents')
  }
}
