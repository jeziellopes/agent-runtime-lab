import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common'

import { notImplemented } from './not-implemented.js'
import { RUNTIME } from '../providers/runtime.provider.js'

import type { ExecuteBody } from './agent-execute.controller.js'
import type { NotImplementedBody } from './not-implemented.js'
import type { AgentRuntime } from '@arl/contracts'

/**
 * `POST /agents/:id/stream` -> SSE `RuntimeEvent`, via `runtime.stream()`.
 *
 * POST, and no `@Sse()`. Frames are written onto the raw response through
 * `../sse/frame-writer.js`; the stream terminates after a terminal event and
 * closes, and a client disconnect cancels the execution.
 */
@Controller()
export class AgentStreamController {
  constructor(@Inject(RUNTIME) private readonly runtime: AgentRuntime) {}

  @Post('agents/:id/stream')
  @HttpCode(501)
  stream(
    @Param('id') _agentId: string,
    @Body() _body: ExecuteBody
  ): NotImplementedBody {
    return notImplemented('POST /agents/:id/stream')
  }
}
