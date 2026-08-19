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
     reported back as a missing prompt.

     `limit` is set explicitly: body-parser's own default is 100kb, well under
     the ~300kb a 50000-token long-context prompt serializes to, and Hono
     imposes no such ceiling. Left unset, the two adapters would reject the
     same request differently for a reason no scenario is measuring. */
  app.useBodyParser('json', { type: () => true, limit: '2mb' })

  // Express emits `x-powered-by` with different casing and in a different
  // position under Node and under Bun. Disabling it removes the divergence.
  app.disable('x-powered-by')

  app.useGlobalFilters(new RuntimeExceptionFilter(app.getHttpAdapter()))

  return app
}
