import { AgentError } from '@arl/contracts'

import type { MemoryStore } from '@arl/contracts'

/**
 * The store keeps this many most recently written namespaces.
 *
 * `memory` is a reported metric in every scenario, so an unbounded store would
 * make it a measurement of accumulated history that grows with run count. The
 * benchmark's own `clear` between iterations is the real teardown; this is a
 * floor under a runner that forgets. The constant is published in the report
 * alongside the memory figures.
 */
export const MAX_NAMESPACES = 1024

/**
 * L6. The only memory implementation that ships.
 *
 * Memory splits into short-term (current conversation, graph state,
 * intermediate results, scoped to one execution) and long-term (prior
 * interactions, scoped to a `sessionId`). `sessionId` is an opaque key that
 * namespaces the second; there is no `Session` entity.
 *
 * Values are stored by reference. A caller that mutates an object after saving
 * it mutates what is stored: a deep clone of every value would distort the
 * footprint this process reports more than the aliasing it prevents.
 */
export class InMemoryStore implements MemoryStore {
  private readonly namespaces = new Map<string, Map<string, unknown>>()

  save(namespace: string, key: string, value: unknown): Promise<void> {
    return new Promise(resolve => {
      requireText('save', 'namespace', namespace)
      requireText('save', 'key', key)

      const existing = this.namespaces.get(namespace)

      /* Re-inserting moves the namespace to the end, which is what makes the
         bound evict by write recency rather than by first write. */
      this.namespaces.delete(namespace)
      this.namespaces.set(namespace, (existing ?? new Map()).set(key, value))

      if (this.namespaces.size > MAX_NAMESPACES) {
        for (const oldest of this.namespaces.keys()) {
          this.namespaces.delete(oldest)
          break
        }
      }

      resolve()
    })
  }

  /**
   * Never written, cleared, evicted and holding no such key all resolve `null`.
   * A store that reported which would be reporting eviction to a caller that
   * has no use for it.
   */
  get(namespace: string, key: string): Promise<unknown | null> {
    return new Promise(resolve => {
      requireText('get', 'namespace', namespace)
      requireText('get', 'key', key)

      resolve(this.namespaces.get(namespace)?.get(key) ?? null)
    })
  }

  clear(namespace: string): Promise<void> {
    return new Promise(resolve => {
      requireText('clear', 'namespace', namespace)

      this.namespaces.delete(namespace)

      resolve()
    })
  }
}

function requireText(method: string, field: string, value: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AgentError(`${method} needs a non-empty ${field}`)
  }
}
