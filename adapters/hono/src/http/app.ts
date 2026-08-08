import { Hono } from 'hono'

import { auth } from './middleware/auth.js'
import { agentExecuteRoutes } from './routes/agent-execute.js'
import { agentStreamRoutes } from './routes/agent-stream.js'
import { agentsListRoutes } from './routes/agents-list.js'
import { executionCancelRoutes } from './routes/execution-cancel.js'
import { executionGetRoutes } from './routes/execution-get.js'
import { healthRoutes } from './routes/health.js'

import type { AgentRuntime } from '@arl/contracts'

export interface Deps {
  runtime: AgentRuntime
}

/**
 * Six routes, composed as functions.
 *
 * The app is a factory, never a module-level singleton.
 */
export function createApp(deps: Deps): Hono {
  return new Hono()
    .use(auth())
    .route('/', healthRoutes())
    .route('/', agentsListRoutes(deps))
    .route('/', agentExecuteRoutes(deps))
    .route('/', agentStreamRoutes(deps))
    .route('/', executionGetRoutes(deps))
    .route('/', executionCancelRoutes(deps))
}
