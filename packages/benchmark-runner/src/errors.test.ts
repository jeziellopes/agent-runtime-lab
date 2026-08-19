import { describe, expect, it } from 'vitest'

import { BenchmarkError } from './errors.js'

describe('a benchmark error', () => {
  it('carries the code it was raised with', () => {
    expect(new BenchmarkError('cell_unknown', 'no such cell').code).toBe(
      'cell_unknown'
    )
  })

  it('carries the detail as its message', () => {
    expect(
      new BenchmarkError('scenario_unknown', 'no such scenario').message
    ).toBe('no such scenario')
  })

  it('is an instance of Error', () => {
    expect(new BenchmarkError('hosts_disagree', 'mismatch')).toBeInstanceOf(
      Error
    )
  })
})
