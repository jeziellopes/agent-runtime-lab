import { serve } from '@hono/node-server'
import { REFERENCE_AGENTS } from '@arl/agents'
import { createRuntime, loadRuntimeConfig } from '@arl/runtime-core'

import { createApp } from './http/app.js'

/**
 * Cell 2: Hono on Node. Boot: configuration, dependencies, listen.
 *
 * The only difference between this and `server.bun.ts` is who terminates the
 * server: Node needs `@hono/node-server`, Bun serves `fetch` natively. The app
 * factory is identical in both.
 */
const app = createApp({
  runtime: createRuntime(loadRuntimeConfig(), REFERENCE_AGENTS)
})

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3001) })
