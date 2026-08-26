import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { writeResults } from '@arl/benchmark-runner'
import { describe, expect, it } from 'vitest'

import { generateReport } from './report.js'

import type {
  CellResults,
  Distribution,
  ScenarioResult
} from '@arl/benchmark-runner'

function distribution(mean: number): Distribution {
  return { mean, p50: mean, p95: mean, p99: mean, stdev: 1, runs: 250 }
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

function row(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
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

function cellResults(id: string, mean: number, host = HOST): CellResults {
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
    interleavedWith: [id],
    host,
    scenarios: [
      row({ latencyMs: distribution(mean) }),
      ...Array.from({ length: 11 }, (_unused, index) =>
        row({
          scenario: `filler-${String(index)}`,
          latencyMs: distribution(mean)
        })
      )
    ]
  }
}

describe('generating the report', () => {
  it('writes report.md per cell and comparison.json plus comparison.md to the out directory', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'arl-'))
    const outDir = mkdtempSync(join(tmpdir(), 'arl-'))

    await writeResults(resultsDir, cellResults('nestjs-node', 10))
    await writeResults(resultsDir, cellResults('hono-node', 12))
    await generateReport({ resultsDir, outDir })

    expect(existsSync(join(outDir, 'nestjs-node', 'report.md'))).toBe(true)
    expect(existsSync(join(outDir, 'hono-node', 'report.md'))).toBe(true)
    expect(existsSync(join(outDir, 'comparison.json'))).toBe(true)
    expect(existsSync(join(outDir, 'comparison.md'))).toBe(true)
  })

  it('exits without throwing when a cell has an unavailable row', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'arl-'))
    const outDir = mkdtempSync(join(tmpdir(), 'arl-'))

    await writeResults(resultsDir, cellResults('nestjs-node', 10))

    const unavailable = cellResults('hono-node', 10)

    await writeResults(resultsDir, {
      ...unavailable,
      scenarios: [
        {
          scenario: 'simple-execution',
          framework: 'hono',
          runtime: 'node',
          runtimeVersion: '',
          llmMode: 'replay',
          status: 'unavailable',
          reason: 'cell_unreachable',
          warmupRuns: 0,
          runs: 0,
          significanceTested: false,
          errorCount: 0
        },
        ...unavailable.scenarios.slice(1)
      ]
    })

    await expect(
      generateReport({ resultsDir, outDir })
    ).resolves.toBeUndefined()

    const comparison = JSON.parse(
      readFileSync(join(outDir, 'comparison.json'), 'utf8')
    ) as { pairings: { rows: { verdict: string }[] }[] }

    expect(comparison.pairings[0]?.rows[0]?.verdict).toBe('cell_unreachable')
  })

  it('renders an ok row that carries no latencyMs without a mean latency figure', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'arl-'))
    const outDir = mkdtempSync(join(tmpdir(), 'arl-'))
    const withoutLatency = cellResults('nestjs-node', 10)

    await writeResults(resultsDir, {
      ...withoutLatency,
      scenarios: [
        row({ scenario: 'multiple-sessions', latencyMs: undefined }),
        ...withoutLatency.scenarios.slice(1)
      ]
    })
    await writeResults(resultsDir, cellResults('hono-node', 10))
    await generateReport({ resultsDir, outDir })

    const report = readFileSync(
      join(outDir, 'nestjs-node', 'report.md'),
      'utf8'
    )

    expect(report).toContain('| multiple-sessions |  | ok | 250 |  |')
  })

  it('throws hosts_disagree for two results files measured on different hosts', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'arl-'))
    const outDir = mkdtempSync(join(tmpdir(), 'arl-'))

    await writeResults(resultsDir, cellResults('nestjs-node', 10))
    await writeResults(
      resultsDir,
      cellResults('hono-node', 10, { ...HOST, memoryGb: 64 })
    )

    await expect(generateReport({ resultsDir, outDir })).rejects.toMatchObject({
      code: 'hosts_disagree'
    })
  })

  it('writes index.html alongside comparison.json and comparison.md, from the repository results', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'arl-'))

    await generateReport({
      resultsDir: join(__dirname, '../../../results'),
      outDir
    })

    expect(existsSync(join(outDir, 'comparison.json'))).toBe(true)
    expect(existsSync(join(outDir, 'comparison.md'))).toBe(true)

    const html = readFileSync(join(outDir, 'index.html'), 'utf8')

    for (const id of ['nestjs-node', 'hono-node', 'nestjs-bun', 'hono-bun']) {
      expect(html).toContain(id)
    }
  })
})
