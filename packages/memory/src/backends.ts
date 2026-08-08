import type { MemoryStore } from '@arl/contracts'

/**
 * No persistent memory backend. In-memory store only.
 *
 * Redis, PostgreSQL and vector stores stay named and unimplemented.
 */
export type RedisMemoryStore = MemoryStore

export type PostgresMemoryStore = MemoryStore

export type VectorMemoryStore = MemoryStore
