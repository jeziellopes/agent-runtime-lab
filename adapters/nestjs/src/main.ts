import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'

import { AppModule } from './modules/app.module.js'

import type { NestExpressApplication } from '@nestjs/platform-express'

/**
 * Cell 1 (Node) and cell 3 (Bun) run this exact compiled output. NestJS runs
 * on Bun with no flags, patches or workarounds.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false
  })

  // Express emits `x-powered-by` with different casing and in a different
  // position under Node and under Bun. Disabling it removes the divergence.
  app.disable('x-powered-by')

  await app.listen(Number(process.env.PORT ?? 3000))
}

bootstrap().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
