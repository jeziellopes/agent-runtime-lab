import { CELLS, findCell } from '@arl/contracts'
import { describe, expect, it } from 'vitest'

import { flag, selected } from './cli.js'

describe('selecting cells', () => {
  it('resolves all four for --all', () => {
    expect(selected(['--all'])).toEqual(CELLS)
  })

  it('resolves all four for an empty argv', () => {
    expect(selected([])).toEqual(CELLS)
  })

  it('resolves the one cell named by --framework and --runtime', () => {
    expect(selected(['--framework', 'hono', '--runtime', 'bun'])).toEqual([
      findCell('hono', 'bun')
    ])
  })
})

describe('reading a flag', () => {
  it('returns the value following the named flag', () => {
    expect(flag(['--host', 'hono-bun'], '--host')).toBe('hono-bun')
  })

  it('returns undefined when the flag is absent', () => {
    expect(flag(['--framework', 'hono'], '--host')).toBeUndefined()
  })

  it('returns undefined for an empty argv', () => {
    expect(flag([], '--host')).toBeUndefined()
  })
})
