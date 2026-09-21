import { executionRequest } from '../parse-request.js'

import type { Deps } from '../app.js'
import type { FastifyPluginCallback } from 'fastify'

/** `POST /agents/:id/execute` -> `ExecutionResult`, via `runtime.execute()`. */
export const agentExecuteRoutes =
  (deps: Deps): FastifyPluginCallback =>
  (app, _options, done) => {
    app.post<{ Params: { id: string } }>('/agents/:id/execute', request =>
      deps.runtime.execute(executionRequest(request.body, request.params.id))
    )
    done()
  }
