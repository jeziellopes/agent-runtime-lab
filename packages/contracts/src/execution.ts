import type { ExecutionStatus } from './execution-status.js'

/** N -> 1 `AgentDefinition`; 1 -> N `RuntimeEvent`. */
export interface Execution {
  id: string
  agentId: string
  status: ExecutionStatus
  input: unknown
  output?: unknown
  createdAt: Date
  completedAt?: Date
}

/**
 * 1 -> 1 `Execution`.
 *
 * `sessionId` is an opaque string key, not an entity: the `MemoryStore`
 * namespaces conversation history under it. There is no `Session` type, no
 * session lifecycle and no session endpoints.
 */
export interface ExecutionContext {
  executionId: string
  agentId: string
  sessionId?: string
  state: Record<string, unknown>
  metadata: Record<string, unknown>
}
