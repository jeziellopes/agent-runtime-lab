import { AgentError } from '@arl/contracts'
import { beforeEach, describe, expect, it } from 'vitest'

import { MAX_NAMESPACES, InMemoryStore } from './in-memory-store.js'

let store: InMemoryStore

beforeEach(() => {
  store = new InMemoryStore()
})

describe('reading what was written', () => {
  it('returns the value saved under the pair', async () => {
    await store.save('a', 'k', 1)

    await expect(store.get('a', 'k')).resolves.toBe(1)
  })

  it('returns null for a namespace never written', async () => {
    await expect(store.get('a', 'k')).resolves.toBeNull()
  })

  it('returns null for a key never written in a namespace that was', async () => {
    await store.save('a', 'k', 1)

    await expect(store.get('a', 'other')).resolves.toBeNull()
  })

  it('overwrites, keeping the second value', async () => {
    await store.save('a', 'k', 1)
    await store.save('a', 'k', 2)

    await expect(store.get('a', 'k')).resolves.toBe(2)
  })

  it('cannot tell a saved null from an unwritten key', async () => {
    await store.save('a', 'k', null)

    await expect(store.get('a', 'k')).resolves.toBeNull()
    await expect(store.get('a', 'unwritten')).resolves.toBeNull()
  })

  it('accepts undefined as a value', async () => {
    await store.save('a', 'k', undefined)

    await expect(store.get('a', 'k')).resolves.toBeNull()
  })
})

describe('namespaces', () => {
  it('keeps the same key in two namespaces apart', async () => {
    await store.save('a', 'k', 1)
    await store.save('b', 'k', 2)

    await expect(store.get('a', 'k')).resolves.toBe(1)
    await expect(store.get('b', 'k')).resolves.toBe(2)
  })

  it('reads nothing across a namespace boundary', async () => {
    await store.save('a', 'k', 1)

    await expect(store.get('b', 'k')).resolves.toBeNull()
  })
})

describe('clearing', () => {
  it('empties one namespace and leaves its neighbour alone', async () => {
    await store.save('a', 'one', 1)
    await store.save('a', 'two', 2)
    await store.save('b', 'one', 3)

    await store.clear('a')

    await expect(store.get('a', 'one')).resolves.toBeNull()
    await expect(store.get('a', 'two')).resolves.toBeNull()
    await expect(store.get('b', 'one')).resolves.toBe(3)
  })

  it('is a no-op on a namespace nobody wrote', async () => {
    await expect(store.clear('never')).resolves.toBeUndefined()
  })
})

describe('the retention bound', () => {
  it('evicts the least recently written once the bound is passed', async () => {
    for (let index = 0; index <= MAX_NAMESPACES; index += 1) {
      await store.save(`ns-${String(index)}`, 'k', index)
    }

    await expect(store.get('ns-0', 'k')).resolves.toBeNull()
    await expect(store.get('ns-1', 'k')).resolves.toBe(1)
    await expect(store.get(`ns-${String(MAX_NAMESPACES)}`, 'k')).resolves.toBe(
      MAX_NAMESPACES
    )
  })

  it('spares a namespace that was rewritten before the eviction', async () => {
    for (let index = 0; index < MAX_NAMESPACES; index += 1) {
      await store.save(`ns-${String(index)}`, 'k', index)
    }

    await store.save('ns-0', 'k', 'rewritten')
    await store.save('one-too-many', 'k', 1)

    await expect(store.get('ns-0', 'k')).resolves.toBe('rewritten')
    await expect(store.get('ns-1', 'k')).resolves.toBeNull()
  })
})

describe('what the arguments must be', () => {
  const bad = [
    ['empty', ''],
    ['absent', undefined],
    ['not a string', 42]
  ] as const

  it.each(bad)('refuses an %s namespace on save', async (_case, namespace) => {
    await expect(
      store.save(namespace as string, 'k', 1)
    ).rejects.toBeInstanceOf(AgentError)
  })

  it.each(bad)('refuses an %s namespace on get', async (_case, namespace) => {
    await expect(store.get(namespace as string, 'k')).rejects.toBeInstanceOf(
      AgentError
    )
  })

  it.each(bad)('refuses an %s namespace on clear', async (_case, namespace) => {
    await expect(store.clear(namespace as string)).rejects.toBeInstanceOf(
      AgentError
    )
  })

  it.each(bad)('refuses an %s key on save', async (_case, key) => {
    await expect(store.save('a', key as string, 1)).rejects.toBeInstanceOf(
      AgentError
    )
  })

  it.each(bad)('refuses an %s key on get', async (_case, key) => {
    await expect(store.get('a', key as string)).rejects.toBeInstanceOf(
      AgentError
    )
  })

  it('names the method and the field it refused', async () => {
    await expect(store.save('', 'k', 1)).rejects.toThrow(
      /save needs a non-empty namespace/
    )
    await expect(store.get('a', '')).rejects.toThrow(
      /get needs a non-empty key/
    )
  })

  it('raises agent-category errors only', async () => {
    await expect(store.clear('')).rejects.toMatchObject({
      category: 'agent',
      code: 'agent_error'
    })
  })
})

describe('storing by reference', () => {
  it('observes a value mutated after it was saved', async () => {
    const value = { count: 1 }

    await store.save('a', 'k', value)
    value.count = 2

    await expect(store.get('a', 'k')).resolves.toEqual({ count: 2 })
  })
})
