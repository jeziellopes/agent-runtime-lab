import { REFERENCE_AGENTS } from '@arl/agents'
import { createRuntime, loadRuntimeConfig } from '@arl/runtime-core'

import { createApp } from './http/app.js'

/**
 * Cells 5 and 6: Fastify on Node and on Bun. Boot: configuration,
 * dependencies, listen.
 *
 * Fastify listens through `node:http` on both runtimes, so one file serves
 * both. Nothing in this file or anything it imports may use a Bun-only API.
 */
const app = createApp({
  runtime: createRuntime(loadRuntimeConfig(), REFERENCE_AGENTS)
})

app
  .listen({ port: Number(process.env.PORT ?? 3004), host: '0.0.0.0' })
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`)
    process.exit(1)
  })
