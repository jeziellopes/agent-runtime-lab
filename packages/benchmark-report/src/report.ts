import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { CELLS } from '@arl/contracts'
import { readResults } from '@arl/benchmark-runner'

import { assertHostsAgree, buildComparison } from './comparison.js'

import type { CellResults, ScenarioResult } from '@arl/benchmark-runner'
import type { Comparison, Pairing } from './comparison.js'

/**
 * Turns raw results into JSON, markdown and the published comparison.
 *
 * Two effects are separated: framework (holding the runtime fixed) and
 * runtime (holding the framework fixed). Every pairing prints its
 * resolution floor alongside its difference of means, and a difference that
 * does not clear it renders as "no measurable difference", never a winner.
 */
export interface ReportOptions {
  resultsDir: string
  outDir: string
}

export async function generateReport(options: ReportOptions): Promise<void> {
  const results = await readAvailable(options.resultsDir)

  assertHostsAgree(results)
  await mkdir(options.outDir, { recursive: true })

  for (const result of results) {
    await writeCellReport(options.outDir, result)
  }

  await writeComparison(options.outDir, buildComparison(results))
}

async function readAvailable(resultsDir: string): Promise<CellResults[]> {
  const results: CellResults[] = []

  for (const cell of CELLS) {
    if (existsSync(join(resultsDir, cell.id, 'metrics.json'))) {
      results.push(await readResults(resultsDir, cell.id))
    }
  }

  return results
}

async function writeCellReport(
  outDir: string,
  result: CellResults
): Promise<void> {
  const dir = join(outDir, result.cell)

  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'report.md'), cellReportMarkdown(result))
}

function cellReportMarkdown(result: CellResults): string {
  const rows = result.scenarios.map(rowLine).join('\n')

  return [
    `# ${result.cell}`,
    '',
    `Framework: ${result.framework} · Runtime: ${result.runtime} (${result.runtimeVersion}) · LLM mode: ${result.llmMode}`,
    '',
    '| Scenario | Variant | Status | Runs | Mean latency (ms) |',
    '| --- | --- | --- | --- | --- |',
    rows,
    ''
  ].join('\n')
}

function rowLine(row: ScenarioResult): string {
  const variant = row.variant ?? ''
  const mean =
    row.status === 'ok' && row.latencyMs !== undefined
      ? row.latencyMs.mean.toFixed(3)
      : (row.reason ?? '')

  return `| ${row.scenario} | ${variant} | ${row.status} | ${String(row.runs)} | ${mean} |`
}

async function writeComparison(
  outDir: string,
  comparison: Comparison
): Promise<void> {
  await writeFile(
    join(outDir, 'comparison.json'),
    JSON.stringify(comparison, null, 2)
  )
  await writeFile(join(outDir, 'comparison.md'), comparisonMarkdown(comparison))
}

function comparisonMarkdown(comparison: Comparison): string {
  const sections = comparison.pairings.map(pairingMarkdown)
  const limitations = comparison.limitations.map(line => `- ${line}`).join('\n')

  return [
    '# Comparison',
    '',
    ...sections,
    '## Limitations',
    '',
    limitations,
    ''
  ].join('\n')
}

function pairingMarkdown(pairing: Pairing): string {
  const rows = pairing.rows.map(pairingRowLine).join('\n')

  return [
    `## ${pairing.name} (${pairing.variable} effect)`,
    '',
    '| Scenario | Variant | Runs | Resolution floor (ms) | Verdict |',
    '| --- | --- | --- | --- | --- |',
    rows,
    ''
  ].join('\n')
}

function pairingRowLine(row: Pairing['rows'][number]): string {
  const variant = row.variant ?? ''
  const floor =
    row.resolutionFloorMs === undefined ? '' : row.resolutionFloorMs.toFixed(3)

  return `| ${row.scenario} | ${variant} | ${String(row.runs)} | ${floor} | ${row.verdict} |`
}
