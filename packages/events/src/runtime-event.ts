import type { RuntimeEventType } from './event-type.js'

/**
 * Shared by `LLMResponse` and by `llm.completed`. It lives here because
 * `@arl/contracts` depends on this package and not the other way round, and
 * `@arl/contracts` re-exports it so callers see one name.
 */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

/**
 * What the runtime accounted for. Shared by `ExecutionResult` and by
 * `execution.completed`, and re-exported by `@arl/contracts` for the same
 * reason as `TokenUsage`.
 *
 * Absent under `RuntimeConfig.deterministic`.
 */
export interface RuntimeMetrics {
  executionDuration: number
  graphDuration: number
  nodeDuration: number
  toolCalls: number
  llmCalls: number
  eventsGenerated: number
}

/**
 * What the runtime emits and what the adapter frames as SSE. The adapter adds
 * the monotonic `id`; the runtime never sees it.
 *
 * Serialised key order is `type`, `executionId`, `timestamp`, `data`, and
 * within `data` the order each member declares. The contract suite compares
 * bytes, and `JSON.stringify` writes keys in insertion order.
 */
interface RuntimeEventBase<T extends RuntimeEventType> {
  type: T
  executionId: string
  timestamp: Date
}

/**
 * A union rather than one interface with `data?: unknown`, so a handler that
 * reads the wrong field fails to compile at the call site instead of surfacing
 * as a byte difference in a golden.
 *
 * `execution.started` and `execution.cancelled` carry no `data` key at all:
 * absence means the event has nothing to say, and `{}` is a value.
 */
export type RuntimeEvent =
  | (RuntimeEventBase<'execution.created'> & { data: { agentId: string } })
  | RuntimeEventBase<'execution.started'>
  | (RuntimeEventBase<'node.started'> & { data: { node: string } })
  | (RuntimeEventBase<'node.completed'> & {
      data: { node: string; branch?: string }
    })
  | (RuntimeEventBase<'llm.started'> & {
      data: { node: string; model: string }
    })
  | (RuntimeEventBase<'llm.token'> & { data: { token: string } })
  | (RuntimeEventBase<'llm.completed'> & {
      data: { node: string; usage: TokenUsage }
    })
  | (RuntimeEventBase<'tool.started'> & {
      data: { tool: string; input: unknown }
    })
  | (RuntimeEventBase<'tool.completed'> & {
      data: { tool: string; output: unknown }
    })
  | (RuntimeEventBase<'execution.completed'> & {
      data: { output: unknown; metrics?: RuntimeMetrics }
    })
  | (RuntimeEventBase<'execution.failed'> & {
      data: { error: string; detail: string }
    })
  | RuntimeEventBase<'execution.cancelled'>

/**
 * One SSE frame. The wire format, byte for byte:
 *
 *     id: <monotonic sequence, per execution, from 1>
 *     event: <RuntimeEvent.type>
 *     data: <the serialized RuntimeEvent>
 *
 * Field order is part of the contract. Neither adapter delegates framing to its
 * framework, and the contract suite asserts the bytes.
 */
export interface SseFrame {
  id: number
  event: RuntimeEventType
  data: RuntimeEvent
}
