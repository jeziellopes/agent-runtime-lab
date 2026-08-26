import { describe, expect, it } from 'vitest'

import { buildComparison } from './comparison.js'
import { renderIndexHtml } from './index-html.js'

import type {
  CellResults,
  Distribution,
  ScenarioResult
} from '@arl/benchmark-runner'
import type { Comparison, Pairing, PairingRow } from './comparison.js'

function distribution(mean: number, stdev = 1, runs = 250): Distribution {
  return { mean, p50: mean, p95: mean, p99: mean, stdev, runs }
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
    frameworkOverheadMs: distribution(2),
    resource: {
      cpuPercent: 10,
      memoryMb: 100,
      peakMemoryMb: 150,
      startupTimeMs: 0
    },
    ...overrides
  }
}

function cell(id: string, scenarios: ScenarioResult[]): CellResults {
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
    startupTimeMs: 300,
    interleavedWith: [id],
    host: HOST,
    scenarios
  }
}

const FOUR_CELLS: CellResults[] = [
  cell('nestjs-node', [okRow()]),
  cell('hono-node', [okRow({ framework: 'hono' })]),
  cell('nestjs-bun', [okRow({ runtime: 'bun' })]),
  cell('hono-bun', [okRow({ framework: 'hono', runtime: 'bun' })])
]

function emptyComparison(): Comparison {
  return { pairings: [], limitations: [], estimatedCostColumn: false }
}

describe('rendering the results index page', () => {
  it('names all four cells when every cell reported', () => {
    const html = renderIndexHtml(FOUR_CELLS, buildComparison(FOUR_CELLS))

    for (const id of ['nestjs-node', 'hono-node', 'nestjs-bun', 'hono-bun']) {
      expect(html).toContain(id)
    }
  })

  it('renders "unavailable" for an unavailable scenario, never undefined or NaN', () => {
    const cells = [
      cell('nestjs-node', [okRow()]),
      cell('hono-node', [
        okRow({
          framework: 'hono',
          status: 'unavailable',
          reason: 'cell_unreachable',
          latencyMs: undefined,
          frameworkOverheadMs: undefined,
          resource: undefined
        })
      ]),
      cell('nestjs-bun', [okRow({ runtime: 'bun' })]),
      cell('hono-bun', [okRow({ framework: 'hono', runtime: 'bun' })])
    ]
    const html = renderIndexHtml(cells, buildComparison(cells))

    expect(html).toContain('unavailable')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('NaN')
  })

  it('renders a no-data notice for zero results, without throwing', () => {
    expect(() => renderIndexHtml([], emptyComparison())).not.toThrow()

    const html = renderIndexHtml([], emptyComparison())

    expect(html).toContain('no benchmark data recorded yet')
  })

  it('scales a comparison bar to the changed mean, not a fixed value', () => {
    const comparisonWithMeanA = (meanA: number): Comparison => {
      const rows: PairingRow[] = [
        {
          scenario: 'simple-execution',
          significanceTested: true,
          runs: 250,
          meanA,
          meanB: 4,
          resolutionFloorMs: 0.1,
          verdict: 'no measurable difference'
        },
        {
          scenario: 'tool-calling',
          significanceTested: true,
          runs: 250,
          meanA: 400,
          meanB: 401,
          resolutionFloorMs: 0.1,
          verdict: 'no measurable difference'
        }
      ]
      const pairing: Pairing = {
        name: 'nestjs-node vs hono-node',
        variable: 'framework',
        cellA: 'nestjs-node',
        cellB: 'hono-node',
        rows
      }

      return {
        pairings: [pairing],
        limitations: [],
        estimatedCostColumn: false
      }
    }

    const results = [
      cell('nestjs-node', [okRow()]),
      cell('hono-node', [okRow({ framework: 'hono' })])
    ]

    const before = renderIndexHtml(results, comparisonWithMeanA(20))
    const after = renderIndexHtml(results, comparisonWithMeanA(60))
    const widthBefore = firstSimpleExecutionBarWidth(before)
    const widthAfter = firstSimpleExecutionBarWidth(after)
    const ratio = widthAfter / widthBefore

    expect(widthAfter).toBeGreaterThan(widthBefore)
    expect(ratio).toBeGreaterThan(2.5)
    expect(ratio).toBeLessThan(3.5)
  })

  it("carries a tested row's variant into its label, with no resolution floor to show", () => {
    const pairing: Pairing = {
      name: 'nestjs-node vs hono-node',
      variable: 'framework',
      cellA: 'nestjs-node',
      cellB: 'hono-node',
      rows: [
        {
          scenario: 'multiple-sessions',
          variant: 'paired',
          significanceTested: true,
          runs: 250,
          meanA: 5,
          meanB: 6,
          verdict: 'no measurable difference'
        }
      ]
    }
    const comparison: Comparison = {
      pairings: [pairing],
      limitations: [],
      estimatedCostColumn: false
    }
    const results = [
      cell('nestjs-node', [okRow()]),
      cell('hono-node', [okRow({ framework: 'hono' })])
    ]
    const html = renderIndexHtml(results, comparison)

    expect(html).toContain('cmp-label">multiple-sessions (paired)</div>')
  })

  it('reads a not-tested concurrency row from scenarioMetrics, never a faster-by verdict', () => {
    const results = [
      cell('nestjs-node', [
        okRow({
          scenario: 'concurrent-executions',
          variant: '10-concurrent',
          significanceTested: false,
          latencyMs: undefined,
          frameworkOverheadMs: undefined,
          scenarioMetrics: {
            rps: 1234,
            mean_latency: 5,
            p95_latency: 6,
            p99_latency: 7,
            error_rate: 0,
            memory_growth: 10
          }
        })
      ]),
      cell('hono-node', [
        okRow({
          framework: 'hono',
          scenario: 'concurrent-executions',
          variant: '10-concurrent',
          significanceTested: false,
          latencyMs: undefined,
          frameworkOverheadMs: undefined,
          scenarioMetrics: {
            rps: 1300,
            mean_latency: 4,
            p95_latency: 5,
            p99_latency: 6,
            error_rate: 0,
            memory_growth: 9
          }
        })
      ])
    ]
    const html = renderIndexHtml(results, buildComparison(results))

    expect(html).toContain('1234')
    expect(html).not.toContain('cmp-label">concurrent-executions')
  })

  it('reads a not-tested long-context row from scenarioMetrics, never a faster-by verdict', () => {
    const results = [
      cell('nestjs-node', [
        okRow({
          scenario: 'long-context',
          variant: '5000-tokens',
          significanceTested: false,
          latencyMs: undefined,
          frameworkOverheadMs: undefined,
          scenarioMetrics: {
            duration: distribution(6.789),
            memory: 300,
            token_processing_time: distribution(5.5),
            streaming_stability: true
          }
        })
      ]),
      cell('hono-node', [
        okRow({
          framework: 'hono',
          scenario: 'long-context',
          variant: '5000-tokens',
          significanceTested: false,
          latencyMs: undefined,
          frameworkOverheadMs: undefined,
          scenarioMetrics: {
            duration: distribution(6.1),
            memory: 280,
            token_processing_time: distribution(5.0),
            streaming_stability: true
          }
        })
      ])
    ]
    const html = renderIndexHtml(results, buildComparison(results))

    expect(html).toContain('6.789')
    expect(html).not.toContain('cmp-label">long-context')
  })

  it('marks a concurrency figure unavailable for an unavailable row, a row absent from a cell, or a non-numeric metric value', () => {
    const results = [
      cell('nestjs-node', [
        okRow({
          scenario: 'concurrent-executions',
          variant: '10-concurrent',
          significanceTested: false,
          latencyMs: undefined,
          frameworkOverheadMs: undefined,
          scenarioMetrics: {
            rps: 1000,
            mean_latency: 1,
            p95_latency: 2,
            p99_latency: 3,
            error_rate: 0,
            memory_growth: true
          }
        })
      ]),
      cell('hono-node', [
        okRow({
          framework: 'hono',
          scenario: 'concurrent-executions',
          variant: '10-concurrent',
          status: 'unavailable',
          reason: 'cell_unreachable',
          significanceTested: false,
          latencyMs: undefined,
          frameworkOverheadMs: undefined,
          resource: undefined
        })
      ]),
      cell('nestjs-bun', [
        okRow({
          runtime: 'bun',
          scenario: 'concurrent-executions',
          variant: '50-concurrent',
          status: 'unavailable',
          reason: 'cell_unreachable',
          significanceTested: false,
          latencyMs: undefined,
          frameworkOverheadMs: undefined,
          resource: undefined
        })
      ])
    ]
    const html = renderIndexHtml(results, buildComparison(results))

    expect(html).toContain('1000')
    expect(html).toContain('unavailable')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('NaN')
  })

  it('omits a stability row for a cell missing the token variant, and renders unstable as text', () => {
    const results = [
      cell('nestjs-node', [
        okRow({
          scenario: 'long-context',
          variant: '5000-tokens',
          significanceTested: false,
          latencyMs: undefined,
          frameworkOverheadMs: undefined,
          scenarioMetrics: {
            duration: distribution(3),
            memory: 200,
            token_processing_time: distribution(2),
            streaming_stability: false
          }
        })
      ]),
      cell('hono-node', [
        okRow({
          framework: 'hono',
          scenario: 'long-context',
          variant: '20000-tokens',
          significanceTested: false,
          latencyMs: undefined,
          frameworkOverheadMs: undefined,
          scenarioMetrics: {
            duration: distribution(9),
            memory: 260,
            token_processing_time: distribution(7),
            streaming_stability: true
          }
        })
      ]),
      cell('nestjs-bun', [
        okRow({
          runtime: 'bun',
          scenario: 'long-context',
          variant: '5000-tokens',
          status: 'unavailable',
          reason: 'cell_unreachable',
          significanceTested: false,
          latencyMs: undefined,
          frameworkOverheadMs: undefined,
          resource: undefined
        })
      ])
    ]
    const html = renderIndexHtml(results, buildComparison(results))

    expect(html).toContain('unstable')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('NaN')
  })

  it('emits no script tag', () => {
    const html = renderIndexHtml(FOUR_CELLS, buildComparison(FOUR_CELLS))

    expect(html.toLowerCase()).not.toContain('<script')
  })
})

function firstSimpleExecutionBarWidth(html: string): number {
  const rowStart = html.indexOf('cmp-label">simple-execution')
  const barMatch = /cmp-bar" style="width:([\d.]+)%/.exec(html.slice(rowStart))

  if (barMatch?.[1] === undefined) {
    throw new Error('no simple-execution bar found')
  }

  return Number(barMatch[1])
}
