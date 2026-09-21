import { ExecutionNotFoundError } from '@arl/contracts'

import type { Deps } from '../app.js'
import type { FastifyPluginCallback } from 'fastify'

/** `GET /executions/:id` -> `Execution`, via `runtime.getExecution()`. */
export const executionGetRoutes =
  (deps: Deps): FastifyPluginCallback =>
  (app, _options, done) => {
    app.get<{ Params: { id: string } }>('/executions/:id', async request => {
      const { id } = request.params
      const execution = await deps.runtime.getExecution(id)

      if (execution === null) {
        throw new ExecutionNotFoundError(`no execution ${id}`)
      }

      return execution
    })
    done()
  }
