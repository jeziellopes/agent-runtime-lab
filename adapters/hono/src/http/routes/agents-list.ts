import { Hono } from 'hono'

import { notImplemented } from '../not-implemented.js'

import type { Deps } from '../app.js'

/** `GET /agents` -> `AgentDefinition[]`, via `runtime.listAgents()`. */
export function agentsListRoutes(_deps: Deps): Hono {
  const app = new Hono()

  app.get('/agents', context =>
    context.json(notImplemented('GET /agents'), 501)
  )

  return app
}
