/**
 * L6. Only the in-memory implementation ships. Redis, PostgreSQL and vector
 * stores stay named, unimplemented interfaces.
 *
 * `clear` tears down session state; a benchmark run calls it between
 * iterations.
 */
export interface MemoryStore {
  save(key: string, value: unknown): Promise<void>
  get(key: string): Promise<unknown | null>
  clear(namespace: string): Promise<void>
}
