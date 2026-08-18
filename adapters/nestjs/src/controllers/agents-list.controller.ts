import { Controller, Get, Inject } from '@nestjs/common'
import { toAgentSummary } from '@arl/contracts'

import { RUNTIME } from '../providers/runtime.provider.js'

import type { AgentRuntime, AgentSummary } from '@arl/contracts'

/** `GET /agents` -> `AgentSummary[]`, via `runtime.listAgents()`. */
@Controller()
export class AgentsListController {
  constructor(@Inject(RUNTIME) private readonly runtime: AgentRuntime) {}

  @Get('agents')
  async list(): Promise<AgentSummary[]> {
    return (await this.runtime.listAgents()).map(toAgentSummary)
  }
}
