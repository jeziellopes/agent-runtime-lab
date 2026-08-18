import { Hono } from 'hono'

import { encodeFrame } from '../../sse/frame-writer.js'
import { executionRequest } from '../parse-request.js'

import type { Deps } from '../app.js'
import type { AgentRuntime } from '@arl/contracts'
import type { RuntimeEvent } from '@arl/events'

/**
 * `POST /agents/:id/stream` -> SSE `RuntimeEvent`, via `runtime.stream()`.
 *
 * POST, not GET, and framed by hand: a `ReadableStream` carrying frames
 * written through `../../sse/frame-writer.js`. A client disconnect, observed
 * on `context.req.raw.signal`, cancels the execution.
 */
export function agentStreamRoutes(deps: Deps): Hono {
  const app = new Hono()

  app.post('/agents/:id/stream', async context => {
    const request = await executionRequest(context, context.req.param('id'))

    /* Resolution and validation fail here, before a byte is written, so they
       are still a status. Everything after the first frame cannot be. */
    const events = deps.runtime.stream(request)

    return new Response(frames(events, deps.runtime, context.req.raw.signal), {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache'
      }
    })
  })

  return app
}

function frames(
  events: AsyncIterable<RuntimeEvent>,
  runtime: AgentRuntime,
  signal: AbortSignal
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      let id = 0
      let executionId: string | undefined

      const disconnected = (): void => {
        if (executionId !== undefined) {
          void runtime.cancel(executionId)
        }
      }

      signal.addEventListener('abort', disconnected)

      try {
        for await (const event of events) {
          executionId = event.executionId
          id += 1
          controller.enqueue(encodeFrame(id, event))
        }
      } finally {
        signal.removeEventListener('abort', disconnected)
        controller.close()
      }
    }
  })
}
