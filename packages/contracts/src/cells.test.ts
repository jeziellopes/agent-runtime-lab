import { describe, expect, it } from 'vitest'

import { CELLS, baseUrl, findCell } from './cells.js'

/**
 * The matrix lives in `contracts` rather than in the suite that first used it:
 * the runner measures the same six cells, and these ports must agree with
 * `scripts/start.mjs` and `docker-compose.yml`.
 */

describe('the six-cell matrix', () => {
  it('is 3 frameworks x 2 runtimes, fully crossed', () => {
    expect(CELLS).toHaveLength(6)

    const pairs = CELLS.map(cell => `${cell.framework}/${cell.runtime}`)

    expect(new Set(pairs).size).toBe(6)
    expect(new Set(CELLS.map(cell => cell.framework))).toEqual(
      new Set(['nestjs', 'hono', 'fastify'])
    )
    expect(new Set(CELLS.map(cell => cell.runtime))).toEqual(
      new Set(['node', 'bun'])
    )
  })

  it('gives every cell its own port and its own results directory', () => {
    expect(new Set(CELLS.map(cell => cell.port)).size).toBe(6)
    expect(new Set(CELLS.map(cell => cell.id)).size).toBe(6)
  })

  it('addresses a cell at its documented port', () => {
    expect(baseUrl(findCell('nestjs', 'node'))).toBe('http://127.0.0.1:3000')
    expect(baseUrl(findCell('hono', 'node'))).toBe('http://127.0.0.1:3001')
    expect(baseUrl(findCell('nestjs', 'bun'))).toBe('http://127.0.0.1:3002')
    expect(baseUrl(findCell('hono', 'bun'), 'cell')).toBe('http://cell:3003')
    expect(baseUrl(findCell('fastify', 'node'))).toBe('http://127.0.0.1:3004')
    expect(baseUrl(findCell('fastify', 'bun'))).toBe('http://127.0.0.1:3005')
  })

  it('appends the Fastify cells after the original four', () => {
    expect(CELLS.map(cell => cell.id)).toEqual([
      'nestjs-node',
      'hono-node',
      'nestjs-bun',
      'hono-bun',
      'fastify-node',
      'fastify-bun'
    ])
  })

  it('refuses a pair that is not in the matrix', () => {
    // @ts-expect-error the matrix is closed; this is what a typo looks like
    expect(() => findCell('express', 'node')).toThrow(/no such cell/)
  })
})
