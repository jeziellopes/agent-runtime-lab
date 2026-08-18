import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import * as memory from './index.js'

const SOURCES = ['backends.ts', 'in-memory-store.ts', 'namespace.ts']

describe('what the package is allowed to reach', () => {
  it('declares no framework dependency and no database client', () => {
    const { dependencies } = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
    ) as { dependencies: Record<string, string> }

    expect(Object.keys(dependencies)).toEqual(['@arl/contracts'])
  })

  it.each(SOURCES)('imports no client or driver in %s', file => {
    expect(readFileSync(join(__dirname, file), 'utf8')).not.toMatch(
      /from '(redis|ioredis|pg|postgres|mongodb|node:net|node:http)/
    )
  })
})

describe('the backends that were kept rather than deleted', () => {
  it('names three unimplemented aliases and constructs none of them', () => {
    const source = readFileSync(join(__dirname, 'backends.ts'), 'utf8')

    for (const alias of [
      'RedisMemoryStore',
      'PostgresMemoryStore',
      'VectorMemoryStore'
    ]) {
      expect(source).toMatch(new RegExp(`export type ${alias} = MemoryStore`))
      expect(memory).not.toHaveProperty(alias)
    }
  })
})
