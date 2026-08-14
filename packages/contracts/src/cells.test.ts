import { describe, expect, it } from 'vitest'

import { CELLS, baseUrl, findCell } from './cells.js'

/**
 * The matrix lives in `contracts` rather than in the suite that first used it:
 * the runner measures the same four cells, and these ports must agree with
 * `scripts/start.mjs` and `docker-compose.yml`.
 */

describe('the four-cell matrix', () => {
  it('is 2 frameworks x 2 runtimes, fully crossed', () => {
    expect(CELLS).toHaveLength(4)

    const pairs = CELLS.map(cell => `${cell.framework}/${cell.runtime}`)

    expect(new Set(pairs).size).toBe(4)
    expect(new Set(CELLS.map(cell => cell.framework))).toEqual(
      new Set(['nestjs', 'hono'])
    )
    expect(new Set(CELLS.map(cell => cell.runtime))).toEqual(
      new Set(['node', 'bun'])
    )
  })

  it('gives every cell its own port and its own results directory', () => {
    expect(new Set(CELLS.map(cell => cell.port)).size).toBe(4)
    expect(new Set(CELLS.map(cell => cell.id)).size).toBe(4)
  })

  it('addresses a cell at its documented port', () => {
    expect(baseUrl(findCell('nestjs', 'node'))).toBe('http://127.0.0.1:3000')
    expect(baseUrl(findCell('hono', 'node'))).toBe('http://127.0.0.1:3001')
    expect(baseUrl(findCell('nestjs', 'bun'))).toBe('http://127.0.0.1:3002')
    expect(baseUrl(findCell('hono', 'bun'), 'cell')).toBe('http://cell:3003')
  })

  it('refuses a pair that is not in the matrix', () => {
    // @ts-expect-error the matrix is closed; this is what a typo looks like
    expect(() => findCell('fastify', 'node')).toThrow(/no such cell/)
  })
})
