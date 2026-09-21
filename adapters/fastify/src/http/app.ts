import Fastify from 'fastify'

import { errorHandler } from './error-mapping.js'
import { auth } from './middleware/auth.js'
import { agentExecuteRoutes } from './routes/agent-execute.js'
import { agentStreamRoutes } from './routes/agent-stream.js'
import { agentsListRoutes } from './routes/agents-list.js'
import { executionCancelRoutes } from './routes/execution-cancel.js'
import { executionGetRoutes } from './routes/execution-get.js'
import { healthRoutes } from './routes/health.js'

import type { AgentRuntime } from '@arl/contracts'
import type { FastifyInstance } from 'fastify'

export interface Deps {
  runtime: AgentRuntime
}

/** The largest request body any of the six endpoints accepts. */
export const BODY_LIMIT_BYTES = 2 * 1024 * 1024

/**
 * Six routes, composed as plugins on one decorated instance.
 *
 * The app is a factory, never a module-level singleton.
 */
export function createApp(deps: Deps): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: BODY_LIMIT_BYTES })

  /* Fastify parses only `application/json` and answers 415 to anything else.
     Every content type is read as text instead, and parsed by the adapter. */
  app.removeAllContentTypeParsers()
  app.addContentTypeParser(
    '*',
    { parseAs: 'string' },
    (_request, body, done) => {
      done(null, body)
    }
  )

  return app
    .setErrorHandler((error, _request, reply) => {
      errorHandler(error, reply)
    })
    .addHook('onRequest', auth())
    .register(healthRoutes())
    .register(agentsListRoutes(deps))
    .register(agentExecuteRoutes(deps))
    .register(agentStreamRoutes(deps))
    .register(executionGetRoutes(deps))
    .register(executionCancelRoutes(deps))
}
