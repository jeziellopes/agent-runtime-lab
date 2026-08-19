import {
  BenchmarkError,
  differsSignificantly,
  resolutionFloor
} from '@arl/benchmark-runner'

import type {
  CellResults,
  Distribution,
  Host,
  ScenarioResult
} from '@arl/benchmark-runner'

export const LIMITATIONS: readonly string[] = [
  'Replay removes real provider latency.',
  "The NestJS adapter bypasses @Sse(), so Nest's own SSE serializer is not measured.",
  'Three cells are resident and idle during every measurement.',
  "Scenario 05's latency comes from autocannon and is not comparable to scenarios 01 through 04.",
  'Any cell needing workarounds has them disclosed as confounds.',
  'The benchmark evaluates this architecture only.'
]

export interface PairingRow {
  scenario: string
  variant?: string
  significanceTested: boolean
  runs: number
  meanA?: number
  meanB?: number
  resolutionFloorMs?: number
  verdict: string
}

export interface Pairing {
  name: string
  variable: 'framework' | 'runtime'
  cellA: string
  cellB: string
  rows: PairingRow[]
}

export interface Comparison {
  pairings: readonly Pairing[]
  limitations: readonly string[]
  estimatedCostColumn: boolean
}

/** `nestjs-node/hono-node` and `nestjs-bun/hono-bun` hold the runtime fixed. */
const FRAMEWORK_PAIRS: readonly [string, string][] = [
  ['nestjs-node', 'hono-node'],
  ['nestjs-bun', 'hono-bun']
]

/** `nestjs-node/nestjs-bun` and `hono-node/hono-bun` hold the framework fixed. */
const RUNTIME_PAIRS: readonly [string, string][] = [
  ['nestjs-node', 'nestjs-bun'],
  ['hono-node', 'hono-bun']
]

/**
 * Two results files whose `host` blocks differ describe two different
 * machines, and comparing across them is the one thing the method forbids.
 */
export function assertHostsAgree(results: readonly CellResults[]): void {
  const first = results[0]

  if (first === undefined) {
    return
  }

  for (const result of results.slice(1)) {
    if (!hostsEqual(first.host, result.host)) {
      throw new BenchmarkError(
        'hosts_disagree',
        `${first.cell} and ${result.cell} were measured on different hosts`
      )
    }
  }
}

function hostsEqual(a: Host, b: Host): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function buildComparison(results: readonly CellResults[]): Comparison {
  const byId = new Map(results.map(result => [result.cell, result]))
  const pairings = [
    ...FRAMEWORK_PAIRS.map(pair => buildPairing(byId, pair, 'framework')),
    ...RUNTIME_PAIRS.map(pair => buildPairing(byId, pair, 'runtime'))
  ]

  return {
    pairings,
    limitations: LIMITATIONS,
    estimatedCostColumn: results.some(result =>
      result.scenarios.some(row => row.llmMode === 'live')
    )
  }
}

function buildPairing(
  byId: ReadonlyMap<string, CellResults>,
  [cellA, cellB]: readonly [string, string],
  variable: 'framework' | 'runtime'
): Pairing {
  const name = `${cellA} vs ${cellB}`
  const a = byId.get(cellA)
  const b = byId.get(cellB)

  if (a === undefined || b === undefined) {
    return { name, variable, cellA, cellB, rows: [] }
  }

  const rows = a.scenarios
    .map(rowA => pairingRow(rowA, matchingRow(b, rowA), cellA, cellB))
    .filter((row): row is PairingRow => row !== undefined)

  return { name, variable, cellA, cellB, rows }
}

function matchingRow(
  cell: CellResults,
  rowA: ScenarioResult
): ScenarioResult | undefined {
  return cell.scenarios.find(
    candidate =>
      candidate.scenario === rowA.scenario && candidate.variant === rowA.variant
  )
}

function pairingRow(
  rowA: ScenarioResult,
  rowB: ScenarioResult | undefined,
  cellA: string,
  cellB: string
): PairingRow | undefined {
  if (rowB === undefined) {
    return undefined
  }

  const base = {
    scenario: rowA.scenario,
    ...(rowA.variant === undefined ? {} : { variant: rowA.variant }),
    significanceTested: rowA.significanceTested,
    runs: Math.min(rowA.runs, rowB.runs)
  }

  if (rowA.status === 'unavailable' || rowB.status === 'unavailable') {
    return { ...base, verdict: rowA.reason ?? rowB.reason ?? 'unavailable' }
  }

  if (
    !rowA.significanceTested ||
    rowA.latencyMs === undefined ||
    rowB.latencyMs === undefined
  ) {
    return { ...base, verdict: 'not tested' }
  }

  return {
    ...base,
    ...testedVerdict(rowA.latencyMs, rowB.latencyMs, cellA, cellB)
  }
}

function testedVerdict(
  a: Distribution,
  b: Distribution,
  cellA: string,
  cellB: string
): Pick<PairingRow, 'meanA' | 'meanB' | 'resolutionFloorMs' | 'verdict'> {
  const floor = resolutionFloor(a, b)

  if (!differsSignificantly(a, b)) {
    return {
      meanA: a.mean,
      meanB: b.mean,
      resolutionFloorMs: floor,
      verdict: 'no measurable difference'
    }
  }

  const faster = a.mean < b.mean ? cellA : cellB

  return {
    meanA: a.mean,
    meanB: b.mean,
    resolutionFloorMs: floor,
    verdict: `${faster} faster by ${Math.abs(a.mean - b.mean).toFixed(3)}ms`
  }
}
