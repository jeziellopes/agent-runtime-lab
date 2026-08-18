import { isTerminalEvent } from '@arl/events'

import type { EmittedEvent, RuntimeEvent } from '@arl/events'

/** ADR-0011's constant, in the one place that decides a timestamp. */
export const EPOCH = new Date(0)

/**
 * The runtime emits events; the adapter's only job is to frame them. One
 * source serves streaming, debugging, observability and the benchmark metrics.
 */
export interface EventStream {
  /**
   * Declares an execution before it publishes anything, so a consumer that
   * attaches in the same tick waits for its first event rather than reading an
   * absent buffer as a finished one.
   */
  open(executionId: string): void
  publish(event: EmittedEvent): void
  events(executionId: string): AsyncIterable<RuntimeEvent>
}

interface Buffer {
  events: RuntimeEvent[]
  waiters: (() => void)[]
  done: boolean
}

/**
 * Each execution's events are retained until its terminal event, so a consumer
 * attaching part-way through still reads from the beginning. That is what makes
 * a gap in the SSE `id` sequence indict the adapter's delivery rather than a
 * race inside the runtime.
 *
 * The buffer is released at the terminal event, so its lifetime is bounded by
 * the execution rather than by run count.
 */
export class InMemoryEventStream implements EventStream {
  private readonly buffers = new Map<string, Buffer>()

  constructor(private readonly deterministic: boolean = false) {}

  /**
   * The one place a timestamp is set. Emitters below this layer cannot see
   * `RuntimeConfig`, so they hand up an event without one.
   */
  open(executionId: string): void {
    this.bufferFor(executionId)
  }

  publish(event: EmittedEvent): void {
    const buffer = this.bufferFor(event.executionId)
    const stamped = stamp(event, this.deterministic ? EPOCH : new Date())

    buffer.events.push(stamped)

    if (isTerminalEvent(stamped.type)) {
      buffer.done = true
      this.buffers.delete(event.executionId)
    }

    for (const wake of buffer.waiters.splice(0)) {
      wake()
    }
  }

  events(executionId: string): AsyncIterable<RuntimeEvent> {
    const buffer = this.buffers.get(executionId)

    return replay(buffer ?? { events: [], waiters: [], done: true })
  }

  private bufferFor(executionId: string): Buffer {
    const existing = this.buffers.get(executionId)

    if (existing !== undefined) {
      return existing
    }

    const created: Buffer = { events: [], waiters: [], done: false }

    this.buffers.set(executionId, created)

    return created
  }
}

/**
 * Built key by key rather than spread. `JSON.stringify` preserves insertion
 * order and the goldens compare bytes: `{ ...event, timestamp }` puts
 * `timestamp` after `data`, and the contract is `type`, `executionId`,
 * `timestamp`, `data`. Two of the twelve carry no `data`, and absent is not the
 * same as empty.
 */
function stamp(event: EmittedEvent, timestamp: Date): RuntimeEvent {
  return {
    type: event.type,
    executionId: event.executionId,
    timestamp,
    ...('data' in event ? { data: event.data } : {})
  } as RuntimeEvent
}

async function* replay(buffer: Buffer): AsyncIterable<RuntimeEvent> {
  let cursor = 0

  for (;;) {
    while (cursor < buffer.events.length) {
      const batch = buffer.events.slice(cursor)

      cursor += batch.length

      yield* batch
    }

    if (buffer.done) {
      return
    }

    await new Promise<void>(resolve => {
      buffer.waiters.push(resolve)
    })
  }
}
