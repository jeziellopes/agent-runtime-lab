import type { RuntimeEvent } from '@arl/events'

import type { AgentDefinition } from './agent-definition.js'
import type { Execution } from './execution.js'
import type { ExecutionStatus } from './execution-status.js'
import type { TokenUsage } from './llm-provider.js'

export interface ExecutionRequest {
  agentId: string
  input: unknown
  sessionId?: string
  metadata?: Record<string, unknown>
}

export interface ExecutionResult {
  executionId: string
  status: ExecutionStatus
  output: unknown
  usage?: TokenUsage
}

/**
 * L2. Five methods, mapping one-to-one onto five of the six HTTP endpoints:
 * `/health` is adapter-local and never reaches the runtime.
 *
 * Streaming is not a second code path: the runtime emits an
 * `AsyncIterable<RuntimeEvent>` and the adapter's only job is to frame it as
 * SSE.
 *
 * This interface imports no HTTP framework and touches no request object.
 */
export interface AgentRuntime {
  execute(request: ExecutionRequest): Promise<ExecutionResult>
  stream(request: ExecutionRequest): AsyncIterable<RuntimeEvent>
  getExecution(id: string): Promise<Execution | null>
  cancel(id: string): Promise<void>
  listAgents(): Promise<AgentDefinition[]>
}
