import { ExecutionNotFoundError } from '@arl/contracts'
import { Hono } from 'hono'

import type { Deps } from '../app.js'

/** `GET /executions/:id` -> `Execution`, via `runtime.getExecution()`. */
export function executionGetRoutes(deps: Deps): Hono {
  const app = new Hono()

  app.get('/executions/:id', async context => {
    const id = context.req.param('id')
    const execution = await deps.runtime.getExecution(id)

    if (execution === null) {
      throw new ExecutionNotFoundError(`no execution ${id}`)
    }

    return context.json(execution)
  })

  return app
}
