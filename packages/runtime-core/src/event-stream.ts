import type { RuntimeEvent, RuntimeEventType } from '@arl/events'

/**
 * The runtime emits events; the adapter's only job is to frame them. One
 * source serves streaming, debugging, observability and the benchmark metrics.
 */
export interface EventStream {
  emit(type: RuntimeEventType, executionId: string, data?: unknown): void
  events(executionId: string): AsyncIterable<RuntimeEvent>
}

export class InMemoryEventStream implements EventStream {
  emit(_type: RuntimeEventType, _executionId: string, _data?: unknown): void {
    throw new Error('InMemoryEventStream.emit is not implemented')
  }

  events(_executionId: string): AsyncIterable<RuntimeEvent> {
    throw new Error('InMemoryEventStream.events is not implemented')
  }
}
