import { Module } from '@nestjs/common'

import { AgentExecuteController } from '../controllers/agent-execute.controller.js'
import { AgentStreamController } from '../controllers/agent-stream.controller.js'
import { AgentsListController } from '../controllers/agents-list.controller.js'
import { ExecutionCancelController } from '../controllers/execution-cancel.controller.js'
import { ExecutionGetController } from '../controllers/execution-get.controller.js'
import { HealthController } from '../controllers/health.controller.js'
import { AuthMiddleware } from '../middleware/auth.middleware.js'
import { runtimeProvider } from '../providers/runtime.provider.js'

import type { AgentRuntime } from '@arl/contracts'
import type {
  DynamicModule,
  MiddlewareConsumer,
  NestModule
} from '@nestjs/common'

/**
 * Six controllers, one per endpoint. This module graph is the composition
 * root, and it receives the runtime rather than building one, so what a test
 * drives is what a cell serves.
 */
@Module({
  controllers: [
    HealthController,
    AgentsListController,
    AgentExecuteController,
    AgentStreamController,
    ExecutionGetController,
    ExecutionCancelController
  ]
})
export class AppModule implements NestModule {
  static withRuntime(runtime: AgentRuntime): DynamicModule {
    return { module: AppModule, providers: [runtimeProvider(runtime)] }
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthMiddleware).forRoutes('*')
  }
}
