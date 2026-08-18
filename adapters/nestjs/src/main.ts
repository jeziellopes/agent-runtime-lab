import 'reflect-metadata'

import { REFERENCE_AGENTS } from '@arl/agents'
import { createRuntime, loadRuntimeConfig } from '@arl/runtime-core'

import { createNestApp } from './app.js'

/**
 * Cell 1 (Node) and cell 3 (Bun) run this exact compiled output. NestJS runs
 * on Bun with no flags, patches or workarounds.
 */
async function bootstrap(): Promise<void> {
  const app = await createNestApp(
    createRuntime(loadRuntimeConfig(), REFERENCE_AGENTS)
  )

  await app.listen(Number(process.env.PORT ?? 3000))
}

bootstrap().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
