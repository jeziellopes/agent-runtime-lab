import { describe, expect, it } from 'vitest'

import { SCENARIOS, metricsFor, workloadFor } from './index.js'

describe('the seven scenarios', () => {
  it('lists one definition per scenario, in numbered order', () => {
    expect(SCENARIOS.map(scenario => scenario.id)).toEqual([
      'simple-execution',
      'streaming',
      'tool-calling',
      'multi-step-workflow',
      'concurrent-executions',
      'long-context',
      'multiple-sessions'
    ])
  })

  it('runs scenario 07 at the latency run count, not the observational one', () => {
    const multipleSessions = SCENARIOS.find(
      scenario => scenario.id === 'multiple-sessions'
    )

    expect(multipleSessions?.measuredRuns).toBe(250)
  })

  it('finds the workload declared for every scenario id', () => {
    for (const scenario of SCENARIOS) {
      expect(workloadFor(scenario.id)).toBeDefined()
    }
  })

  it('finds the metrics declared for every scenario id', () => {
    for (const scenario of SCENARIOS) {
      expect(metricsFor(scenario.id)?.length).toBeGreaterThan(0)
    }
  })

  it('finds nothing for an unknown scenario id', () => {
    expect(workloadFor('no-such-scenario')).toBeUndefined()
    expect(metricsFor('no-such-scenario')).toBeUndefined()
  })
})
