import { Hono } from 'hono'

import { notImplemented } from '../not-implemented.js'

import type { Deps } from '../app.js'

/**
 * `DELETE /executions/:id` -> `204`, via `runtime.cancel()`.
 *
 * On cancellation the graph halts, the in-flight LLM request is aborted and
 * token billing stops. Reporting `CANCELLED` while the provider call continues
 * is a contract failure.
 */
export function executionCancelRoutes(_deps: Deps): Hono {
  const app = new Hono()

  app.delete('/executions/:id', context =>
    context.json(notImplemented('DELETE /executions/:id'), 501)
  )

  return app
}
