import type { EmittedEvent } from '@arl/events'

/**
 * The bridge between the graph engine, which drives itself, and `stream`, which
 * is pulled by its consumer.
 *
 * Nodes push as they emit and the consumer yields as it reads, so a token
 * reaches the wire while the graph is still running. Collecting the run and
 * yielding afterwards would produce the same bytes and a different measurement,
 * and time to first token is one of the things being measured.
 */
export interface EventQueue {
  push(event: EmittedEvent): void
  close(failure?: unknown): void
  drain(): AsyncIterable<EmittedEvent>
}

export function createEventQueue(): EventQueue {
  const buffered: EmittedEvent[] = []
  let wake: (() => void) | undefined
  let closed = false
  let failure: unknown

  const notify = (): void => {
    const pending = wake

    wake = undefined
    pending?.()
  }

  return {
    push(event) {
      buffered.push(event)
      notify()
    },

    close(reason) {
      closed = true
      failure = reason
      notify()
    },

    async *drain() {
      for (;;) {
        let next = buffered.shift()

        while (next !== undefined) {
          yield next
          next = buffered.shift()
        }

        if (closed) {
          if (failure !== undefined) {
            throw failure
          }

          return
        }

        await new Promise<void>(resolve => {
          wake = resolve
        })
      }
    }
  }
}
