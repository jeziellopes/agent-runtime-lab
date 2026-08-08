import type { RuntimeEventType } from './event-type.js'

/**
 * What the runtime emits and what the adapter frames as SSE. The adapter adds
 * the monotonic `id`; the runtime never sees it.
 */
export interface RuntimeEvent {
  type: RuntimeEventType
  executionId: string
  timestamp: Date
  data?: unknown
}

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
