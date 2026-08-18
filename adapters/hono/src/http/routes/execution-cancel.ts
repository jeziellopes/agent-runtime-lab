import { Hono } from 'hono'

import type { Deps } from '../app.js'

/**
 * `DELETE /executions/:id` -> `204`, via `runtime.cancel()`.
 *
 * On cancellation the graph halts, the in-flight LLM request is aborted and
 * token billing stops. Reporting `CANCELLED` while the provider call continues
 * is a contract failure.
 *
 * `204` for a running execution, an already-terminal one and an id that never
 * existed alike: reporting the difference would leak execution existence
 * through a status code.
 */
export function executionCancelRoutes(deps: Deps): Hono {
  const app = new Hono()

  app.delete('/executions/:id', async context => {
    await deps.runtime.cancel(context.req.param('id'))

    return context.body(null, 204)
  })

  return app
}
