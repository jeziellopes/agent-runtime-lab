import { encodeFrame } from '../../sse/frame-writer.js'
import { executionRequest } from '../parse-request.js'

import type { Deps } from '../app.js'
import type { AgentRuntime } from '@arl/contracts'
import type { RuntimeEvent } from '@arl/events'
import type { FastifyPluginCallback, FastifyReply } from 'fastify'

/**
 * `POST /agents/:id/stream` -> SSE `RuntimeEvent`, via `runtime.stream()`.
 *
 * POST, not GET, and framed by hand on the raw response, which Fastify no
 * longer manages once the reply is hijacked. A client disconnect, observed as
 * the close of that response, cancels the execution.
 */
export const agentStreamRoutes =
  (deps: Deps): FastifyPluginCallback =>
  (app, _options, done) => {
    app.post<{ Params: { id: string } }>(
      '/agents/:id/stream',
      (request, reply) => {
        /* Resolution and validation fail here, before a byte is written, so
           they are still a status. Everything after the first frame cannot be. */
        const events = deps.runtime.stream(
          executionRequest(request.body, request.params.id)
        )

        void pipe(events, deps.runtime, reply)
      }
    )
    done()
  }

async function pipe(
  events: AsyncIterable<RuntimeEvent>,
  runtime: AgentRuntime,
  reply: FastifyReply
): Promise<void> {
  reply.hijack()

  const raw = reply.raw
  let id = 0
  let executionId: string | undefined
  let finished = false

  raw.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache'
  })
  raw.flushHeaders()

  raw.once('close', () => {
    if (!finished && executionId !== undefined) {
      void runtime.cancel(executionId)
    }
  })

  try {
    for await (const event of events) {
      executionId = event.executionId
      id += 1
      raw.write(encodeFrame(id, event))
    }
  } catch {
    /* The headers are sent, so no status can be written. Ending the response
       is the only signal left. */
  } finally {
    finished = true
    raw.end()
  }
}
