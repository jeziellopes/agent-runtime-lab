import { Hono } from 'hono'

import { notImplemented } from '../not-implemented.js'

import type { Deps } from '../app.js'

/** `GET /executions/:id` -> `Execution`, via `runtime.getExecution()`. */
export function executionGetRoutes(_deps: Deps): Hono {
  const app = new Hono()

  app.get('/executions/:id', context =>
    context.json(notImplemented('GET /executions/:id'), 501)
  )

  return app
}
