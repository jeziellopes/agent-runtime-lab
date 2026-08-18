import { toAgentSummary } from '@arl/contracts'
import { Hono } from 'hono'

import type { Deps } from '../app.js'

/** `GET /agents` -> `AgentSummary[]`, via `runtime.listAgents()`. */
export function agentsListRoutes(deps: Deps): Hono {
  const app = new Hono()

  app.get('/agents', async context =>
    context.json((await deps.runtime.listAgents()).map(toAgentSummary))
  )

  return app
}
