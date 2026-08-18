import { Hono } from 'hono'

import { executionRequest } from '../parse-request.js'

import type { Deps } from '../app.js'

/** `POST /agents/:id/execute` -> `ExecutionResult`, via `runtime.execute()`. */
export function agentExecuteRoutes(deps: Deps): Hono {
  const app = new Hono()

  app.post('/agents/:id/execute', async context =>
    context.json(
      await deps.runtime.execute(
        await executionRequest(context, context.req.param('id'))
      )
    )
  )

  return app
}
