import { Body, Controller, Inject, Param, Post, Res } from '@nestjs/common'

import { ExecutionRequestPipe } from '../pipes/execution-request.pipe.js'
import { RUNTIME } from '../providers/runtime.provider.js'
import { writeFrame } from '../sse/frame-writer.js'

import type { ExecutionBody } from '../pipes/execution-request.pipe.js'
import type { AgentRuntime } from '@arl/contracts'
import type { ServerResponse } from 'node:http'

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
  async stream(
    @Param('id') agentId: string,
    @Body(ExecutionRequestPipe) body: ExecutionBody,
    @Res() response: ServerResponse
  ): Promise<void> {
    /* Resolution fails here, before a byte is written, so it is still a status.
       Everything after the first frame cannot be. */
    const events = this.runtime.stream({ agentId, ...body })

    let id = 0
    let executionId: string | undefined

    const disconnected = (): void => {
      if (executionId !== undefined) {
        void this.runtime.cancel(executionId)
      }
    }

    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache'
    })
    response.flushHeaders()
    response.on('close', disconnected)

    try {
      for await (const event of events) {
        executionId = event.executionId
        id += 1
        writeFrame(response, id, event)
      }
    } finally {
      response.off('close', disconnected)
      response.end()
    }
  }
}
