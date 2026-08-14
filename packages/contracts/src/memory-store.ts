/**
 * L6. Only the in-memory implementation ships. Redis, PostgreSQL and vector
 * stores stay named, unimplemented interfaces.
 *
 * The namespace is a parameter of every operation, not a convention callers
 * compose into the key. A node that wrote `save('history', value)` would share
 * one bucket across every session, compile, and pass its own tests.
 *
 * `clear` tears down session state; a benchmark run calls it between
 * iterations.
 */
export interface MemoryStore {
  save(namespace: string, key: string, value: unknown): Promise<void>
  get(namespace: string, key: string): Promise<unknown | null>
  clear(namespace: string): Promise<void>
}
