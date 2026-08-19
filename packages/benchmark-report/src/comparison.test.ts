import { describe, expect, it } from 'vitest'

import { LIMITATIONS, assertHostsAgree, buildComparison } from './comparison.js'

import type {
  CellResults,
  Distribution,
  ScenarioResult
} from '@arl/benchmark-runner'

function distribution(mean: number, stdev = 1, runs = 250): Distribution {
  return { mean, p50: mean, p95: mean, p99: mean, stdev, runs }
}

function okRow(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    scenario: 'simple-execution',
    framework: 'nestjs',
    runtime: 'node',
    runtimeVersion: '24.4.1',
    llmMode: 'replay',
    status: 'ok',
    warmupRuns: 50,
    runs: 250,
    significanceTested: true,
    errorCount: 0,
    latencyMs: distribution(10),
    ...overrides
  }
}

const HOST = {
  cpu: 'AMD Ryzen 7 5800X',
  cores: { physical: 8, logical: 16 },
  memoryGb: 32,
  os: 'linux',
  kernel: '6.8.0',
  nodeVersion: '24.4.1',
  bunVersion: '1.1.38'
}

function cell(id: string, overrides: Partial<CellResults> = {}): CellResults {
  const [framework, runtime] = id.split('-') as [
    'nestjs' | 'hono',
    'node' | 'bun'
  ]

  return {
    cell: id,
    framework,
    runtime,
    runtimeVersion: '24.4.1',
    llmMode: 'replay',
    startedAt: '2026-08-18T00:00:00.000Z',
    startupTimeMs: 842,
    interleavedWith: ['nestjs-node', 'hono-node', 'nestjs-bun', 'hono-bun'],
    host: HOST,
    scenarios: [okRow()],
    ...overrides
  }
}

const FOUR_CELLS: readonly CellResults[] = [
  cell('nestjs-node'),
  cell('hono-node'),
  cell('nestjs-bun'),
  cell('hono-bun')
]

describe('the four-cell comparison', () => {
  it('contains exactly four pairings, two framework and two runtime', () => {
    const comparison = buildComparison(FOUR_CELLS)

    expect(comparison.pairings).toHaveLength(4)
    expect(
      comparison.pairings.filter(p => p.variable === 'framework')
    ).toHaveLength(2)
    expect(
      comparison.pairings.filter(p => p.variable === 'runtime')
    ).toHaveLength(2)
  })

  it('holds the runtime fixed in a framework pairing', () => {
    const comparison = buildComparison(FOUR_CELLS)
    const pairing = comparison.pairings.find(
      p => p.name === 'nestjs-node vs hono-node'
    )

    expect(pairing?.variable).toBe('framework')
  })

  it('holds the framework fixed in a runtime pairing', () => {
    const comparison = buildComparison(FOUR_CELLS)
    const pairing = comparison.pairings.find(
      p => p.name === 'nestjs-node vs nestjs-bun'
    )

    expect(pairing?.variable).toBe('runtime')
  })

  it('renders exactly "no measurable difference" when the floor is not cleared, never a winner', () => {
    const cells = [
      cell('nestjs-node', {
        scenarios: [okRow({ latencyMs: distribution(10, 1, 250) })]
      }),
      cell('hono-node', {
        scenarios: [okRow({ latencyMs: distribution(10.01, 1, 250) })]
      })
    ]
    const comparison = buildComparison(cells)
    const row = comparison.pairings[0]?.rows[0]

    expect(row?.verdict).toBe('no measurable difference')
  })

  it('prints the resolution floor alongside a tested difference of means', () => {
    const cells = [
      cell('nestjs-node', {
        scenarios: [okRow({ latencyMs: distribution(10, 0, 250) })]
      }),
      cell('hono-node', {
        scenarios: [okRow({ latencyMs: distribution(100, 0, 250) })]
      })
    ]
    const comparison = buildComparison(cells)
    const row = comparison.pairings[0]?.rows[0]

    expect(row?.resolutionFloorMs).toBeDefined()
    expect(row?.meanA).toBe(10)
    expect(row?.meanB).toBe(100)
    expect(row?.verdict).not.toBe('no measurable difference')
  })

  it('names the second cell as faster when its mean is the lower one', () => {
    const cells = [
      cell('nestjs-node', {
        scenarios: [okRow({ latencyMs: distribution(100, 0, 250) })]
      }),
      cell('hono-node', {
        scenarios: [okRow({ latencyMs: distribution(10, 0, 250) })]
      })
    ]
    const comparison = buildComparison(cells)

    expect(comparison.pairings[0]?.rows[0]?.verdict).toContain('hono-node')
  })

  it('carries the variant a row names', () => {
    const cells = [
      cell('nestjs-node', {
        scenarios: [okRow({ variant: '10-concurrent' })]
      }),
      cell('hono-node', { scenarios: [okRow({ variant: '10-concurrent' })] })
    ]
    const comparison = buildComparison(cells)

    expect(comparison.pairings[0]?.rows[0]?.variant).toBe('10-concurrent')
  })

  it('renders "unavailable" when neither unavailable row names a reason', () => {
    const cells = [
      cell('nestjs-node', {
        scenarios: [
          okRow({
            status: 'unavailable',
            reason: undefined,
            latencyMs: undefined
          })
        ]
      }),
      cell('hono-node', {
        scenarios: [
          okRow({
            status: 'unavailable',
            reason: undefined,
            latencyMs: undefined
          })
        ]
      })
    ]
    const comparison = buildComparison(cells)

    expect(comparison.pairings[0]?.rows[0]?.verdict).toBe('unavailable')
  })

  it('renders an unavailable cell as its row reason, without throwing', () => {
    const cells = [
      cell('nestjs-node', {
        scenarios: [
          {
            scenario: 'simple-execution',
            framework: 'nestjs',
            runtime: 'node',
            runtimeVersion: '',
            llmMode: 'replay',
            status: 'unavailable',
            reason: 'cell_unreachable',
            warmupRuns: 0,
            runs: 0,
            significanceTested: false,
            errorCount: 0
          }
        ]
      }),
      cell('hono-node')
    ]
    const comparison = buildComparison(cells)

    expect(comparison.pairings[0]?.rows[0]?.verdict).toBe('cell_unreachable')
  })

  it("falls back to the paired cell's reason when the first cell names none", () => {
    const cells = [
      cell('nestjs-node', {
        scenarios: [
          okRow({
            status: 'unavailable',
            reason: undefined,
            latencyMs: undefined
          })
        ]
      }),
      cell('hono-node', {
        scenarios: [
          okRow({
            status: 'unavailable',
            reason: 'metrics_absent',
            latencyMs: undefined
          })
        ]
      })
    ]
    const comparison = buildComparison(cells)

    expect(comparison.pairings[0]?.rows[0]?.verdict).toBe('metrics_absent')
  })

  it('never passes a row with significanceTested false through the significance test', () => {
    const cells = [
      cell('nestjs-node', {
        scenarios: [
          okRow({
            scenario: 'concurrent-executions',
            significanceTested: false,
            latencyMs: distribution(1)
          })
        ]
      }),
      cell('hono-node', {
        scenarios: [
          okRow({
            scenario: 'concurrent-executions',
            significanceTested: false,
            latencyMs: distribution(1_000_000)
          })
        ]
      })
    ]
    const comparison = buildComparison(cells)

    expect(comparison.pairings[0]?.rows[0]?.verdict).toBe('not tested')
  })

  it('omits a row whose scenario is absent from the paired cell', () => {
    const cells = [
      cell('nestjs-node', {
        scenarios: [okRow(), okRow({ scenario: 'streaming' })]
      }),
      cell('hono-node', { scenarios: [okRow()] })
    ]
    const comparison = buildComparison(cells)

    expect(comparison.pairings[0]?.rows).toHaveLength(1)
  })

  it('carries the run count on every row', () => {
    const comparison = buildComparison(FOUR_CELLS)

    for (const pairing of comparison.pairings) {
      for (const row of pairing.rows) {
        expect(row.runs).toBeGreaterThan(0)
      }
    }
  })

  it('names all six limitations', () => {
    const comparison = buildComparison(FOUR_CELLS)

    expect(comparison.limitations).toEqual(LIMITATIONS)
    expect(comparison.limitations).toHaveLength(6)
  })

  it('carries the estimated cost column only when a row is live', () => {
    expect(buildComparison(FOUR_CELLS).estimatedCostColumn).toBe(false)

    const live = [
      cell('nestjs-node', { scenarios: [okRow({ llmMode: 'live' })] }),
      cell('hono-node')
    ]

    expect(buildComparison(live).estimatedCostColumn).toBe(true)
  })
})

describe('agreeing hosts', () => {
  it('does not throw when every host block matches', () => {
    expect(() => assertHostsAgree(FOUR_CELLS)).not.toThrow()
  })

  it('does not throw when there are no results to compare', () => {
    expect(() => assertHostsAgree([])).not.toThrow()
  })

  it('throws hosts_disagree when two host blocks differ', () => {
    const mismatched = [
      cell('nestjs-node'),
      cell('hono-node', { host: { ...HOST, memoryGb: 64 } })
    ]

    expect.assertions(1)

    try {
      assertHostsAgree(mismatched)
    } catch (error) {
      expect(error).toMatchObject({ code: 'hosts_disagree' })
    }
  })
})
