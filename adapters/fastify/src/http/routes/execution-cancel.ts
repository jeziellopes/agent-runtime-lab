import type { Deps } from '../app.js'
import type { FastifyPluginCallback } from 'fastify'

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
export const executionCancelRoutes =
  (deps: Deps): FastifyPluginCallback =>
  (app, _options, done) => {
    app.delete<{ Params: { id: string } }>(
      '/executions/:id',
      async (request, reply) => {
        await deps.runtime.cancel(request.params.id)

        return reply.status(204).send()
      }
    )
    done()
  }
