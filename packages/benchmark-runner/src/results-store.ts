import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { BenchmarkError } from './errors.js'

import type { Framework, JsRuntime, LLMMode } from '@arl/contracts'
import type { Host } from './host.js'
import type { ScenarioResult } from './metrics.js'

/** Twelve rows: one each for 01, 02, 03, 04 and 07, four for 05, three for 06. */
export const ROWS_PER_CELL = 12

export interface CellResults {
  cell: string
  framework: Framework
  runtime: JsRuntime
  runtimeVersion: string
  llmMode: LLMMode
  startedAt: string
  interleavedWith: readonly string[]
  host: Host
  scenarios: readonly ScenarioResult[]
}

function fileFor(resultsDir: string, cellId: string): string {
  return join(resultsDir, cellId, 'metrics.json')
}

export async function writeResults(
  resultsDir: string,
  results: CellResults
): Promise<void> {
  const path = fileFor(resultsDir, results.cell)

  await mkdir(join(resultsDir, results.cell), { recursive: true })
  await writeFile(path, JSON.stringify(results, null, 2))
}

export async function readResults(
  resultsDir: string,
  cellId: string
): Promise<CellResults> {
  const path = fileFor(resultsDir, cellId)

  let raw: string

  try {
    raw = await readFile(path, 'utf8')
  } catch (cause) {
    throw new BenchmarkError(
      'results_unreadable',
      `${path}: could not be read (${String(cause)})`
    )
  }

  let results: CellResults

  try {
    results = JSON.parse(raw) as CellResults
  } catch (cause) {
    throw new BenchmarkError(
      'results_unreadable',
      `${path}: not valid JSON (${String(cause)})`
    )
  }

  if (results.scenarios.length < ROWS_PER_CELL) {
    throw new BenchmarkError(
      'results_incomplete',
      `${path}: ${String(results.scenarios.length)} rows, want ${String(ROWS_PER_CELL)}`
    )
  }

  return results
}
