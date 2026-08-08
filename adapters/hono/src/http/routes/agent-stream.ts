import { Hono } from 'hono'

import { notImplemented } from '../not-implemented.js'

import type { Deps } from '../app.js'

/**
 * `POST /agents/:id/stream` -> SSE `RuntimeEvent`, via `runtime.stream()`.
 *
 * POST, not GET, and framed by hand: a `ReadableStream` carrying frames
 * written through `../../sse/frame-writer.js`. A client disconnect, observed
 * on `context.req.raw.signal`, cancels the execution.
 */
export function agentStreamRoutes(_deps: Deps): Hono {
  const app = new Hono()

  app.post('/agents/:id/stream', context =>
    context.json(notImplemented('POST /agents/:id/stream'), 501)
  )

  return app
}
