import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { BenchmarkError } from './errors.js'
import { readResults, writeResults } from './results-store.js'

import type { CellResults } from './results-store.js'
import type { ScenarioResult } from './metrics.js'

function row(scenario: string): ScenarioResult {
  return {
    scenario,
    framework: 'hono',
    runtime: 'node',
    runtimeVersion: '24.4.1',
    llmMode: 'replay',
    status: 'ok',
    warmupRuns: 50,
    runs: 250,
    significanceTested: true,
    errorCount: 0
  }
}

function cellResults(overrides: Partial<CellResults> = {}): CellResults {
  return {
    cell: 'hono-node',
    framework: 'hono',
    runtime: 'node',
    runtimeVersion: '24.4.1',
    llmMode: 'replay',
    startedAt: '2026-08-18T00:00:00.000Z',
    interleavedWith: ['hono-node'],
    host: {
      cpu: 'AMD Ryzen 7 5800X',
      cores: { physical: 8, logical: 16 },
      memoryGb: 32,
      os: 'linux',
      kernel: '6.8.0',
      nodeVersion: '24.4.1',
      bunVersion: '1.1.38'
    },
    scenarios: Array.from({ length: 12 }, (_unused, index) =>
      row(`scenario-${String(index)}`)
    ),
    ...overrides
  }
}

describe('results on disk', () => {
  it('round-trips through writeResults and readResults', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'arl-'))
    const written = cellResults()

    await writeResults(dir, written)

    expect(await readResults(dir, 'hono-node')).toEqual(written)
  })

  it('writes a host block with a non-empty cpu, a positive logical core count, a positive memory figure and a runtime version', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'arl-'))

    await writeResults(dir, cellResults())

    const read = await readResults(dir, 'hono-node')

    expect(read.host.cpu.length).toBeGreaterThan(0)
    expect(read.host.cores.logical).toBeGreaterThan(0)
    expect(read.host.memoryGb).toBeGreaterThan(0)
    expect(read.runtimeVersion).toBe('24.4.1')
  })

  it('throws results_unreadable on a missing file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'arl-'))

    await expect(readResults(dir, 'no-such-cell')).rejects.toMatchObject({
      code: 'results_unreadable'
    })
    await expect(readResults(dir, 'no-such-cell')).rejects.toBeInstanceOf(
      BenchmarkError
    )
  })

  it('throws results_unreadable on a file that does not parse', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'arl-'))

    mkdirSync(join(dir, 'broken'))
    writeFileSync(join(dir, 'broken', 'metrics.json'), '{ not json')

    await expect(readResults(dir, 'broken')).rejects.toMatchObject({
      code: 'results_unreadable'
    })
  })

  it('throws results_incomplete on a file with fewer than twelve rows', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'arl-'))

    await writeResults(
      dir,
      cellResults({ scenarios: [row('simple-execution')] })
    )

    await expect(readResults(dir, 'hono-node')).rejects.toMatchObject({
      code: 'results_incomplete'
    })
  })
})
