import { describe, expect, it } from 'vitest'

import { flag } from './cli.js'

describe('reading a flag', () => {
  it('returns the value following the named flag', () => {
    expect(flag(['--out-dir', 'results'], '--out-dir')).toBe('results')
  })

  it('returns undefined when the flag is absent, whatever else argv holds', () => {
    expect(flag(['--out-dir', 'results'], '--results-dir')).toBeUndefined()
  })

  it('returns undefined for an empty argv', () => {
    expect(flag([], '--out-dir')).toBeUndefined()
  })
})
