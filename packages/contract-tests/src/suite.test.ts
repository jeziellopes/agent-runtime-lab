import { describe, expect, it } from 'vitest'

import { CELLS } from './cells.js'
import { CONTRACT_ASSERTIONS, runContractSuite } from './suite.js'

describe('the equivalence gate', () => {
  it('enumerates one assertion per endpoint on the surface', () => {
    const endpoints = [
      'health.response',
      'agents.list',
      'agents.execute',
      'agents.stream',
      'executions.get',
      'executions.cancel'
    ]

    expect(CONTRACT_ASSERTIONS).toEqual(expect.arrayContaining(endpoints))
    expect(new Set(CONTRACT_ASSERTIONS).size).toBe(CONTRACT_ASSERTIONS.length)
  })

  it('asserts SSE on the bytes, not on a normalised event object', () => {
    expect(CONTRACT_ASSERTIONS).toContain('sse.framing.bytes')
    expect(CONTRACT_ASSERTIONS).toContain('sse.event.id.monotonic')
  })

  it('asserts a mid-stream error is an event and not a status code', () => {
    expect(CONTRACT_ASSERTIONS).toContain('error.midstream.is.event.not.status')
  })

  it('is unimplemented, deliberately and visibly', () => {
    for (const cell of CELLS) {
      expect(() => runContractSuite(cell)).toThrow(/not implemented/)
    }
  })
})
