import { NestFactory } from '@nestjs/core'

import { RuntimeExceptionFilter } from './errors/runtime-exception.filter.js'
import { AppModule } from './modules/app.module.js'

import type { AgentRuntime } from '@arl/contracts'
import type { NestExpressApplication } from '@nestjs/platform-express'

/**
 * The composition root, called by `main.ts` and by the adapter's own tests, so
 * what is tested is what a cell serves.
 */
export async function createNestApp(
  runtime: AgentRuntime
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.withRuntime(runtime),
    { logger: false, bodyParser: false }
  )

  /* Every body is parsed as JSON whatever the request claimed. The header is
     not part of the contract, and a body that silently became `{}` would be
     reported back as a missing prompt. */
  app.useBodyParser('json', { type: () => true })

  // Express emits `x-powered-by` with different casing and in a different
  // position under Node and under Bun. Disabling it removes the divergence.
  app.disable('x-powered-by')

  app.useGlobalFilters(new RuntimeExceptionFilter(app.getHttpAdapter()))

  return app
}
