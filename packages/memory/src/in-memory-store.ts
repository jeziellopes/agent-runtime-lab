import type { MemoryStore } from '@arl/contracts'

/**
 * L6. The only memory implementation that ships.
 *
 * Memory splits into short-term (current conversation, graph state,
 * intermediate results, scoped to one execution) and long-term (prior
 * interactions, scoped to a `sessionId`). `sessionId` is an opaque key that
 * namespaces the second; there is no `Session` entity.
 *
 * `clear` tears down session state; a benchmark run calls it between
 * iterations.
 */
export class InMemoryStore implements MemoryStore {
  save(_key: string, _value: unknown): Promise<void> {
    throw new Error('InMemoryStore.save is not implemented')
  }

  get(_key: string): Promise<unknown | null> {
    throw new Error('InMemoryStore.get is not implemented')
  }

  clear(_namespace: string): Promise<void> {
    throw new Error('InMemoryStore.clear is not implemented')
  }
}
