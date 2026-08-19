import { findCell } from '@arl/contracts'
import { afterEach, describe, expect, it } from 'vitest'

import { spawnCell, stopCell } from './process.js'
import {
  buildConcurrencyRow,
  buildLatencyRow,
  driveConcurrency,
  resolveMatrix,
  resolveScenarios,
  run
} from './runner.js'

import type { SpawnedCell } from './process.js'

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)

    return true
  } catch {
    return false
  }
}

describe('resolving the matrix', () => {
  it('restricts to one cell when framework and runtime are both named', () => {
    expect(resolveMatrix({ framework: 'hono', runtime: 'bun' })).toEqual([
      findCell('hono', 'bun')
    ])
  })

  it('restricts to the two cells sharing a framework', () => {
    expect(resolveMatrix({ framework: 'nestjs' }).map(cell => cell.id)).toEqual(
      ['nestjs-node', 'nestjs-bun']
    )
  })

  it('restricts to the two cells sharing a runtime', () => {
    expect(resolveMatrix({ runtime: 'bun' }).map(cell => cell.id)).toEqual([
      'nestjs-bun',
      'hono-bun'
    ])
  })

  it('throws cell_unknown for an unrecognised framework', () => {
    expect(() => resolveMatrix({ framework: 'express' })).toThrow(
      expect.objectContaining({ code: 'cell_unknown' })
    )
  })

  it('throws cell_unknown for an unrecognised runtime', () => {
    expect(() => resolveMatrix({ runtime: 'deno' })).toThrow(
      expect.objectContaining({ code: 'cell_unknown' })
    )
  })
})

describe('resolving the scenarios', () => {
  it('resolves all seven when none is named', () => {
    expect(resolveScenarios(undefined)).toHaveLength(7)
  })

  it('resolves the one scenario named', () => {
    expect(resolveScenarios('streaming').map(scenario => scenario.id)).toEqual([
      'streaming'
    ])
  })

  it('throws scenario_unknown for an unrecognised scenario', () => {
    expect(() => resolveScenarios('no-such-scenario')).toThrow(
      expect.objectContaining({ code: 'scenario_unknown' })
    )
  })
})

describe('running the pipeline against a live cell', () => {
  it('throws scenario_unknown before spawning anything', async () => {
    await expect(
      run({ scenario: 'no-such-scenario', framework: 'hono', runtime: 'node' })
    ).rejects.toMatchObject({ code: 'scenario_unknown' })
  })

  it('throws cell_unknown before spawning anything', async () => {
    await expect(run({ framework: 'express' })).rejects.toMatchObject({
      code: 'cell_unknown'
    })
  })

  describe('a single-cell, single-scenario run', () => {
    it('spawns and stops the one cell it names, recording a single-cell interleave', async () => {
      const results = await run({
        scenario: 'simple-execution',
        framework: 'hono',
        runtime: 'bun'
      })

      expect(results).toHaveLength(1)

      const [cell] = results

      expect(cell?.interleavedWith).toEqual(['hono-bun'])
      expect(cell?.startupTimeMs).toBeGreaterThan(0)
      expect(processAlive(process.pid)).toBe(true)
    }, 30_000)

    it('records exactly the latency run count, with the framework overhead present', async () => {
      const results = await run({
        scenario: 'simple-execution',
        framework: 'hono',
        runtime: 'bun'
      })
      const [row] = results[0]?.scenarios ?? []

      expect(row?.status).toBe('ok')
      expect(row?.runs).toBe(250)
      expect(row?.significanceTested).toBe(true)
      expect(row?.frameworkOverheadMs).toBeDefined()
      expect(row?.errorCount).toBe(0)
    }, 30_000)

    it('carries no framework overhead for the streaming scenario', async () => {
      const results = await run({
        scenario: 'streaming',
        framework: 'hono',
        runtime: 'bun'
      })
      const [row] = results[0]?.scenarios ?? []

      expect(row?.frameworkOverheadMs).toBeUndefined()
      expect(row?.scenarioMetrics?.['time_to_first_token']).toBeDefined()
    }, 30_000)

    it('emits one row per synthetic length, each carrying its exact input token count', async () => {
      const results = await run({
        scenario: 'long-context',
        framework: 'hono',
        runtime: 'bun'
      })
      const rows = results[0]?.scenarios ?? []

      expect(rows).toHaveLength(3)
      expect(rows.map(row => row.significanceTested)).toEqual([
        false,
        false,
        false
      ])
      expect(rows.map(row => row.llm?.inputTokens)).toEqual([
        5000, 20000, 50000
      ])
    }, 30_000)

    it('reports both sessions isolated against a real spawned cell', async () => {
      const results = await run({
        scenario: 'multiple-sessions',
        framework: 'hono',
        runtime: 'bun'
      })
      const [row] = results[0]?.scenarios ?? []

      expect(row?.runs).toBe(250)
      expect(row?.errorCount).toBe(0)
      expect(row?.scenarioMetrics?.['session_isolation']).toBe(true)
      expect(row?.significanceTested).toBe(true)
      expect(row?.latencyMs?.runs).toBe(250)
    }, 30_000)

    it('resolves the multi-step-workflow fixture and reports no errors', async () => {
      const results = await run({
        scenario: 'multi-step-workflow',
        framework: 'hono',
        runtime: 'bun'
      })
      const [row] = results[0]?.scenarios ?? []

      expect(row?.status).toBe('ok')
      expect(row?.errorCount).toBe(0)
      expect(row?.scenarioMetrics).toEqual({
        node_transition_latency: expect.any(Object),
        state_update_latency: expect.any(Object),
        total_time: expect.any(Object)
      })
    }, 30_000)

    it('resolves the tool-agent fixture and reports the tool-calling metrics', async () => {
      const results = await run({
        scenario: 'tool-calling',
        framework: 'hono',
        runtime: 'bun'
      })
      const [row] = results[0]?.scenarios ?? []

      expect(row?.status).toBe('ok')
      expect(row?.errorCount).toBe(0)
      expect(row?.scenarioMetrics).toEqual({
        total_duration: expect.any(Object),
        tool_execution_time: expect.any(Object),
        event_count: expect.any(Object),
        error_rate: 0
      })
    }, 30_000)
  })

  describe('a cell running deterministic', () => {
    const original = process.env['DETERMINISTIC']

    afterEach(() => {
      if (original === undefined) {
        delete process.env['DETERMINISTIC']
      } else {
        process.env['DETERMINISTIC'] = original
      }
    })

    it('records deterministic_mode rather than metrics_absent', async () => {
      process.env['DETERMINISTIC'] = 'true'

      const results = await run({
        scenario: 'simple-execution',
        framework: 'hono',
        runtime: 'bun'
      })
      const [row] = results[0]?.scenarios ?? []

      expect(row?.status).toBe('unavailable')
      expect(row?.reason).toBe('deterministic_mode')
    }, 30_000)
  })
})

describe('driving concurrency directly', () => {
  let spawned: SpawnedCell | undefined

  afterEach(() => {
    if (spawned !== undefined) {
      stopCell(spawned)
      spawned = undefined
    }
  })

  it('emits one row per concurrency level, with no framework overhead field', async () => {
    const cell = findCell('hono', 'bun')

    spawned = await spawnCell(cell, '127.0.0.1')

    const rows = await driveConcurrency(
      {
        id: 'concurrent-executions',
        agentId: 'simple-agent',
        measures: '',
        measuredRuns: 3
      },
      [cell],
      { host: '127.0.0.1', spawned: new Map([[cell.id, spawned]]) },
      {
        metricNames: [
          'rps',
          'mean_latency',
          'p95_latency',
          'p99_latency',
          'error_rate',
          'memory_growth'
        ],
        durationS: 1
      }
    )
    const cellRows = rows.get(cell.id) ?? []

    expect(cellRows).toHaveLength(4)
    expect(cellRows.map(row => row.variant)).toEqual([
      '1-concurrent',
      '10-concurrent',
      '50-concurrent',
      '100-concurrent'
    ])

    for (const row of cellRows) {
      expect(row.significanceTested).toBe(false)
      expect(row.frameworkOverheadMs).toBeUndefined()
      expect(row.latencyMs).toBeUndefined()
      expect(row.errorCount).toBe(0)
    }
  }, 30_000)
})

describe('buildConcurrencyRow', () => {
  it('throws results_incomplete when the declared metric names do not match', () => {
    const cell = findCell('hono', 'bun')
    const scenario = {
      id: 'concurrent-executions',
      agentId: 'simple-agent',
      measures: '',
      measuredRuns: 3
    }
    const resource = { cpuPercent: 0, memoryMb: 0, heapMb: 0, startupTimeMs: 0 }

    expect(() =>
      buildConcurrencyRow(scenario, cell, {
        level: 10,
        runs: [],
        resource,
        metricNames: ['not_a_real_metric']
      })
    ).toThrow(expect.objectContaining({ code: 'results_incomplete' }))
  })
})

describe('buildLatencyRow', () => {
  it('reads as metrics_absent when every sample lacks metrics outside deterministic mode', () => {
    const original = process.env['DETERMINISTIC']

    delete process.env['DETERMINISTIC']

    try {
      const scenario = {
        id: 'simple-execution',
        agentId: 'simple-agent',
        measures: '',
        measuredRuns: 250
      }
      const cell = findCell('hono', 'bun')
      const row = buildLatencyRow(
        scenario,
        cell,
        [{ requestLatencyMs: 5, ok: true }],
        {
          resource: { cpuPercent: 0, memoryMb: 0, heapMb: 0, startupTimeMs: 0 },
          metricNames: [
            'total_latency',
            'framework_overhead',
            'runtime_time',
            'memory',
            'cpu'
          ],
          streaming: false
        }
      )

      expect(row.status).toBe('unavailable')
      expect(row.reason).toBe('metrics_absent')
    } finally {
      if (original === undefined) {
        delete process.env['DETERMINISTIC']
      } else {
        process.env['DETERMINISTIC'] = original
      }
    }
  })
})
