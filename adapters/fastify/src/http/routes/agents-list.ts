import { toAgentSummary } from '@arl/contracts'

import type { Deps } from '../app.js'
import type { FastifyPluginCallback } from 'fastify'

/** `GET /agents` -> `AgentSummary[]`, via `runtime.listAgents()`. */
export const agentsListRoutes =
  (deps: Deps): FastifyPluginCallback =>
  (app, _options, done) => {
    app.get('/agents', async () =>
      (await deps.runtime.listAgents()).map(toAgentSummary)
    )
    done()
  }
