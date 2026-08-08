import { Hono } from 'hono'

import { notImplemented } from '../not-implemented.js'

import type { Deps } from '../app.js'

/** `POST /agents/:id/execute` -> `ExecutionResult`, via `runtime.execute()`. */
export function agentExecuteRoutes(_deps: Deps): Hono {
  const app = new Hono()

  app.post('/agents/:id/execute', context =>
    context.json(notImplemented('POST /agents/:id/execute'), 501)
  )

  return app
}
