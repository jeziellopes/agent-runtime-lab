import { REFERENCE_AGENTS } from '@arl/agents'
import { createRuntime, loadRuntimeConfig } from '@arl/runtime-core'

import { createApp } from './http/app.js'

/**
 * Cell 4: Hono on Bun. Bun serves a default export of `{ fetch, port }`
 * natively, so there is no adapter package and no listener code here.
 *
 * Nothing in this file or anything it imports may use a Bun-only API.
 */
const app = createApp({
  runtime: createRuntime(loadRuntimeConfig(), REFERENCE_AGENTS)
})

export default {
  fetch: app.fetch,
  port: Number(process.env.PORT ?? 3003)
}
