import { findCell } from '@arl/contracts'

import {
  MEASURED_RUNS_LATENCY,
  MEASURED_RUNS_OBSERVATIONAL,
  WARMUP_RUNS,
  Z_95
} from '@arl/benchmark-runner'

import type { Cell } from '@arl/contracts'
import type {
  CellResults,
  Distribution,
  ScenarioResult
} from '@arl/benchmark-runner'
import type { Comparison, Pairing, PairingRow } from './comparison.js'

/** Headroom above the tallest bar in a group, so it never sits flush at 100%. */
const BAR_HEADROOM = 1.15

const CONCURRENCY_METRICS: readonly string[] = [
  'rps',
  'mean_latency',
  'p95_latency',
  'p99_latency',
  'error_rate',
  'memory_growth'
]

const LONG_CONTEXT_METRICS: readonly string[] = [
  'duration',
  'token_processing_time'
]

/**
 * Renders `results` and `comparison` as a single static HTML page. Structure
 * and styling are fixed; every figure comes from the arguments. An empty
 * `results` renders a no-data notice in place of the data sections, rather
 * than throwing.
 */
export function renderIndexHtml(
  results: CellResults[],
  comparison: Comparison
): string {
  const body =
    results.length === 0 ? renderNoData() : renderPopulated(results, comparison)

  return [
    '<!doctype html>',
    '<html lang="en">',
    `<head>${HEAD}</head>`,
    '<body>',
    '<main>',
    renderHeader(results),
    body,
    renderLimitations(comparison),
    renderFooter(),
    '</main>',
    '</body>',
    '</html>',
    ''
  ].join('\n')
}

function renderPopulated(
  results: readonly CellResults[],
  comparison: Comparison
): string {
  return [
    renderMatrixLegend(),
    renderCellGrid(results),
    renderComparisonSection(
      'Framework effect',
      `Runtime held fixed. ${String(MEASURED_RUNS_LATENCY)} measured runs per row (${String(WARMUP_RUNS)} warmup). Resolution floor is ${Z_95.toFixed(2)}&times;SE: a gap smaller than the floor prints as no measurable difference, never a coin-flip winner.`,
      comparison.pairings.filter(pairing => pairing.variable === 'framework')
    ),
    renderComparisonSection(
      'Runtime effect',
      'Framework held fixed. Same rows, same floor rule, just the other axis of the matrix.',
      comparison.pairings.filter(pairing => pairing.variable === 'runtime')
    ),
    renderConcurrencySection(results),
    renderLongContextSection(results)
  ].join('\n')
}

function renderNoData(): string {
  return [
    '<section>',
    '<div class="notice">no benchmark data recorded yet</div>',
    '</section>'
  ].join('\n')
}

function renderHeader(results: readonly CellResults[]): string {
  const first = results[0]

  return [
    '<header>',
    '<span class="eyebrow">agent-runtime-lab &middot; benchmark comparison</span>',
    '<h1>Framework Overhead</h1>',
    '<p class="standfirst">',
    'One agent runtime core, exposed through two HTTP adapters, NestJS and',
    'Hono, each run under both Node and Bun. Every scenario replays the same',
    'recorded token stream, so what differs between cells is the framework',
    'and the runtime, not the model.',
    '<code>framework_overhead = request_latency &minus; execution_duration</code>.',
    '</p>',
    first === undefined ? '' : renderNameplate(first),
    '</header>'
  ].join('\n')
}

function renderNameplate(result: CellResults): string {
  const host = result.host

  return [
    '<div class="nameplate">',
    `<span><b>Host</b> ${escapeHtml(host.cpu)} &middot; ${String(host.cores.physical)}c/${String(host.cores.logical)}t &middot; ${host.memoryGb.toFixed(0)}&nbsp;GB RAM &middot; ${escapeHtml(host.os)} ${escapeHtml(host.kernel)}</span>`,
    `<span><b>Node</b> ${escapeHtml(host.nodeVersion)}</span>`,
    `<span><b>Bun</b> ${escapeHtml(host.bunVersion)}</span>`,
    `<span><b>LLM mode</b> ${escapeHtml(result.llmMode)}</span>`,
    '</div>'
  ].join('\n')
}

function renderMatrixLegend(): string {
  return [
    '<section>',
    '<div class="section-head"><h2>The test matrix</h2></div>',
    '<div class="axis-legend">',
    '<span class="corner">&nbsp;</span>',
    '<span class="col-head">Node</span>',
    '<span class="col-head">Bun</span>',
    '<span class="row-head">NestJS</span>',
    renderMatrixCell(findCell('nestjs', 'node')),
    renderMatrixCell(findCell('nestjs', 'bun')),
    '<span class="row-head">Hono</span>',
    renderMatrixCell(findCell('hono', 'node')),
    renderMatrixCell(findCell('hono', 'bun')),
    '</div>',
    '</section>'
  ].join('\n')
}

function renderMatrixCell(cell: Cell): string {
  return [
    `<span class="swatch-cell" style="background:var(--${cell.id}-bg); color:var(--${cell.id});">`,
    `<span class="dot" style="background:var(--${cell.id});"></span>${escapeHtml(cell.id)}`,
    '</span>'
  ].join('')
}

function renderCellGrid(results: readonly CellResults[]): string {
  const cards = results.map(renderCellCard).join('\n')

  return [
    '<section>',
    '<div class="section-head">',
    '<h2>The four cells</h2>',
    '<p>Startup comes from a fresh boot. Latency and overhead come from the',
    'simple-execution scenario, the cheapest apples-to-apples row. Peak',
    'memory is the resident high-water mark since boot, not since any one',
    'scenario.</p>',
    '</div>',
    `<div class="cell-grid">${cards}</div>`,
    '</section>'
  ].join('\n')
}

function renderCellCard(result: CellResults): string {
  const row = result.scenarios.find(
    scenario =>
      scenario.scenario === 'simple-execution' && scenario.variant === undefined
  )

  return [
    `<div class="cell-card cell-${result.cell}">`,
    `<h3>${escapeHtml(result.cell)}</h3>`,
    '<dl>',
    `<dt>Startup</dt><dd>${result.startupTimeMs.toFixed(0)}&nbsp;ms</dd>`,
    `<dt>Peak memory</dt><dd>${peakMemoryFigure(row)}</dd>`,
    `<dt>Latency</dt><dd>${scenarioFigure(row, scenario => scenario.latencyMs)}</dd>`,
    `<dt>Overhead</dt><dd>${scenarioFigure(row, scenario => scenario.frameworkOverheadMs)}</dd>`,
    '</dl>',
    '</div>'
  ].join('\n')
}

function scenarioFigure(
  row: ScenarioResult | undefined,
  pick: (row: ScenarioResult) => Distribution | undefined
): string {
  if (row === undefined || row.status === 'unavailable') {
    return 'unavailable'
  }

  const distribution = pick(row)

  return distribution === undefined
    ? 'unavailable'
    : `${distribution.mean.toFixed(3)}&nbsp;ms`
}

function peakMemoryFigure(row: ScenarioResult | undefined): string {
  if (
    row === undefined ||
    row.status === 'unavailable' ||
    row.resource === undefined
  ) {
    return 'unavailable'
  }

  return `${row.resource.peakMemoryMb.toFixed(0)}&nbsp;MB`
}

function renderComparisonSection(
  title: string,
  description: string,
  pairings: readonly Pairing[]
): string {
  const panels = pairings.map(renderPanel).join('\n')

  return [
    '<section>',
    '<div class="section-head">',
    `<h2>${escapeHtml(title)}</h2>`,
    `<p>${description}</p>`,
    '</div>',
    `<div class="panel-pair">${panels}</div>`,
    '</section>'
  ].join('\n')
}

function renderPanel(pairing: Pairing): string {
  const tested = pairing.rows.filter(row => row.significanceTested)
  const scaleMax = panelScaleMax(tested)
  const rows = tested
    .map(row => renderCmpRow(row, pairing, scaleMax))
    .join('\n')

  return [
    '<div class="panel">',
    `<div class="panel-title">${escapeHtml(pairing.cellA)} <span class="vs">vs</span> ${escapeHtml(pairing.cellB)}</div>`,
    rows,
    '</div>'
  ].join('\n')
}

function panelScaleMax(rows: readonly PairingRow[]): number {
  const values = rows.flatMap(row =>
    row.meanA === undefined || row.meanB === undefined
      ? []
      : [row.meanA, row.meanB]
  )
  const max = values.length === 0 ? 0 : Math.max(...values)

  return max > 0 ? max * BAR_HEADROOM : 1
}

function renderCmpRow(
  row: PairingRow,
  pairing: Pairing,
  scaleMax: number
): string {
  const label =
    row.variant === undefined
      ? row.scenario
      : `${row.scenario} (${row.variant})`

  if (row.meanA === undefined || row.meanB === undefined) {
    return [
      '<div class="cmp-row">',
      `<div class="cmp-label">${escapeHtml(label)}</div>`,
      `<div class="cmp-meta"><span class="pill pill-neutral">${escapeHtml(row.verdict)}</span></div>`,
      '</div>'
    ].join('\n')
  }

  const faster =
    row.verdict === 'no measurable difference'
      ? undefined
      : row.meanA < row.meanB
        ? pairing.cellA
        : pairing.cellB
  const pillClass = faster === undefined ? 'pill-neutral' : `pill-${faster}`
  const floor =
    row.resolutionFloorMs === undefined
      ? ''
      : `<span class="floor">floor ${row.resolutionFloorMs.toFixed(3)}</span>`

  return [
    '<div class="cmp-row">',
    `<div class="cmp-label">${escapeHtml(label)}</div>`,
    '<div class="cmp-bars">',
    `<div class="cmp-bar-track"><div class="cmp-bar" style="width:${widthPercent(row.meanA, scaleMax)}%; background:var(--${pairing.cellA});"></div><span class="cmp-value">${row.meanA.toFixed(3)}&nbsp;ms</span></div>`,
    `<div class="cmp-bar-track"><div class="cmp-bar" style="width:${widthPercent(row.meanB, scaleMax)}%; background:var(--${pairing.cellB});"></div><span class="cmp-value">${row.meanB.toFixed(3)}&nbsp;ms</span></div>`,
    '</div>',
    `<div class="cmp-meta">${floor}<span class="pill ${pillClass}">${escapeHtml(row.verdict)}</span></div>`,
    '</div>'
  ].join('\n')
}

function widthPercent(value: number, scaleMax: number): string {
  return Math.min(100, Math.max(1, (value / scaleMax) * 100)).toFixed(1)
}

function renderConcurrencySection(results: readonly CellResults[]): string {
  const levels = uniqueVariants(results, 'concurrent-executions')

  if (levels.length === 0) {
    return ''
  }

  const cards = levels
    .map(level => renderConcurrencyCard(results, level))
    .join('\n')

  return [
    '<section>',
    '<div class="section-head">',
    '<h2>Concurrency</h2>',
    `<p>Driven against a live cell: ${String(MEASURED_RUNS_OBSERVATIONAL)} runs per`,
    'level, per cell. Not significance-tested, and not comparable to the',
    'scenarios above: it measures its own latency and cannot read execution',
    'duration, so it reports throughput, not overhead.</p>',
    '</div>',
    `<div class="conc-grid">${cards}</div>`,
    '</section>'
  ].join('\n')
}

function renderConcurrencyCard(
  results: readonly CellResults[],
  level: string
): string {
  const blocks = CONCURRENCY_METRICS.map(metric =>
    renderMetricBlock(results, 'concurrent-executions', level, metric)
  ).join('\n')

  return [
    '<div class="conc-card">',
    `<span class="level">${escapeHtml(level)}</span>`,
    blocks,
    '</div>'
  ].join('\n')
}

function renderLongContextSection(results: readonly CellResults[]): string {
  const tokenCounts = uniqueVariants(results, 'long-context')

  if (tokenCounts.length === 0) {
    return ''
  }

  const cards = tokenCounts
    .map(tokens => renderLongContextCard(results, tokens))
    .join('\n')

  return [
    '<section>',
    '<div class="section-head">',
    '<h2>Long context</h2>',
    `<p>Synthetic prompts, ${String(MEASURED_RUNS_OBSERVATIONAL)} measured runs each.`,
    'Not significance-tested: the small sample makes these directional,',
    'especially at the highest token counts.</p>',
    '</div>',
    `<div class="lc-grid">${cards}</div>`,
    '</section>'
  ].join('\n')
}

function renderLongContextCard(
  results: readonly CellResults[],
  tokens: string
): string {
  const metricBlocks = LONG_CONTEXT_METRICS.map(metric =>
    renderMetricBlock(results, 'long-context', tokens, metric)
  ).join('\n')
  const memoryBlock = renderMetricBlock(
    results,
    'long-context',
    tokens,
    'memory'
  )
  const stability = results
    .map(result => renderStabilityRow(result, tokens))
    .filter((line): line is string => line !== undefined)
    .join('\n')

  return [
    '<div class="lc-card">',
    `<span class="tokens">${escapeHtml(tokens)}</span>`,
    metricBlocks,
    memoryBlock,
    '<div class="metric-block">',
    '<span class="metric-name">Streaming stability</span>',
    stability,
    '</div>',
    '</div>'
  ].join('\n')
}

function renderStabilityRow(
  result: CellResults,
  tokens: string
): string | undefined {
  const row = result.scenarios.find(
    scenario =>
      scenario.scenario === 'long-context' && scenario.variant === tokens
  )

  if (row === undefined) {
    return undefined
  }

  const raw =
    row.status === 'ok'
      ? row.scenarioMetrics?.['streaming_stability']
      : undefined
  const text =
    typeof raw === 'boolean' ? (raw ? 'stable' : 'unstable') : 'unavailable'

  return `<div class="stability-row"><span class="mini-label">${escapeHtml(result.cell)}</span><span class="mini-value">${text}</span></div>`
}

/**
 * `variant` must come from `uniqueVariants(results, scenario)`, so at least
 * one result carries a matching row and `entries` is never empty.
 */
function renderMetricBlock(
  results: readonly CellResults[],
  scenario: string,
  variant: string,
  metric: string
): string {
  const entries = results.flatMap(result => {
    const row = result.scenarios.find(
      candidate =>
        candidate.scenario === scenario && candidate.variant === variant
    )

    if (row === undefined) {
      return []
    }

    const value =
      row.status === 'ok'
        ? numericValue(row.scenarioMetrics?.[metric])
        : undefined

    return [{ cell: result.cell, value }]
  })

  const known = entries.flatMap(entry =>
    entry.value === undefined ? [] : [entry.value]
  )
  const rawMax = known.length === 0 ? 0 : Math.max(...known)
  const max = rawMax > 0 ? rawMax * BAR_HEADROOM : 1
  const rows = entries
    .map(entry => renderMiniRow(entry.cell, entry.value, max))
    .join('\n')

  return [
    '<div class="metric-block">',
    `<span class="metric-name">${escapeHtml(metricLabel(metric))}</span>`,
    rows,
    '</div>'
  ].join('\n')
}

function renderMiniRow(
  cellId: string,
  value: number | undefined,
  max: number
): string {
  if (value === undefined) {
    return `<div class="mini-row"><span class="mini-label">${escapeHtml(cellId)}</span><span class="mini-value">unavailable</span></div>`
  }

  return `<div class="mini-row"><span class="mini-label">${escapeHtml(cellId)}</span><div class="mini-track"><div class="mini-bar" style="width:${widthPercent(value, max)}%; background:var(--${cellId});"></div></div><span class="mini-value">${formatNumber(value)}</span></div>`
}

function numericValue(
  raw: Distribution | number | boolean | undefined
): number | undefined {
  if (typeof raw === 'number') {
    return raw
  }

  if (typeof raw === 'boolean' || raw === undefined) {
    return undefined
  }

  return raw.mean
}

function metricLabel(metric: string): string {
  return metric.replace(/_/g, ' ')
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value)
  }

  return value < 10 ? value.toFixed(3) : value.toFixed(2)
}

function uniqueVariants(
  results: readonly CellResults[],
  scenario: string
): string[] {
  const seen: string[] = []

  for (const result of results) {
    for (const row of result.scenarios) {
      if (
        row.scenario === scenario &&
        row.variant !== undefined &&
        !seen.includes(row.variant)
      ) {
        seen.push(row.variant)
      }
    }
  }

  return seen
}

function renderLimitations(comparison: Comparison): string {
  if (comparison.limitations.length === 0) {
    return ''
  }

  const items = comparison.limitations
    .map(line => `<li>${escapeHtml(line)}</li>`)
    .join('\n')

  return [
    '<section>',
    '<div class="limitations">',
    '<span class="eyebrow">Limitations</span>',
    `<ul>${items}</ul>`,
    '</div>',
    '</section>'
  ].join('\n')
}

function renderFooter(): string {
  return [
    '<footer>',
    '<span>Source: results/comparison.json &middot; results/&lt;cell&gt;/metrics.json</span>',
    "<span>Full percentile detail (p50/p95/p99) lives in each cell's report.md</span>",
    '</footer>'
  ].join('\n')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const STYLE = `
  :root {
    --paper: #f1f3f5;
    --paper-raised: #ffffff;
    --ink: #14171c;
    --ink-soft: #52606d;
    --ink-faint: #7c8a97;
    --border: #d7dce1;
    --border-soft: #e6e9ec;
    --chrome: #3e5c76;
    --chrome-soft: #e7ecf1;

    --nestjs-node: #a8431c;
    --nestjs-bun: #d68a3f;
    --hono-node: #0b6e77;
    --hono-bun: #2fa79e;

    --nestjs-node-bg: rgb(168 67 28 / 0.12);
    --nestjs-bun-bg: rgb(214 138 63 / 0.14);
    --hono-node-bg: rgb(11 110 119 / 0.12);
    --hono-bun-bg: rgb(47 167 158 / 0.14);

    --font-display: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
    --font-mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Consolas, monospace;
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper: #0f1216;
      --paper-raised: #171b21;
      --ink: #e7eaee;
      --ink-soft: #9aa4b2;
      --ink-faint: #6b7480;
      --border: #262c34;
      --border-soft: #1d232b;
      --chrome: #8fb4d9;
      --chrome-soft: #1b2530;

      --nestjs-node: #dd7d47;
      --nestjs-bun: #eab06b;
      --hono-node: #37b3ba;
      --hono-bun: #6fd6cb;

      --nestjs-node-bg: rgb(221 125 71 / 0.16);
      --nestjs-bun-bg: rgb(234 176 107 / 0.14);
      --hono-node-bg: rgb(55 179 186 / 0.16);
      --hono-bun-bg: rgb(111 214 203 / 0.14);
    }
  }

  :root[data-theme="dark"] {
    --paper: #0f1216;
    --paper-raised: #171b21;
    --ink: #e7eaee;
    --ink-soft: #9aa4b2;
    --ink-faint: #6b7480;
    --border: #262c34;
    --border-soft: #1d232b;
    --chrome: #8fb4d9;
    --chrome-soft: #1b2530;

    --nestjs-node: #dd7d47;
    --nestjs-bun: #eab06b;
    --hono-node: #37b3ba;
    --hono-bun: #6fd6cb;

    --nestjs-node-bg: rgb(221 125 71 / 0.16);
    --nestjs-bun-bg: rgb(234 176 107 / 0.14);
    --hono-node-bg: rgb(55 179 186 / 0.16);
    --hono-bun-bg: rgb(111 214 203 / 0.14);
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 15px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }

  main {
    max-width: 1180px;
    margin: 0 auto;
    padding: 2.75rem 1.75rem 5rem;
    display: flex;
    flex-direction: column;
    gap: 3.25rem;
  }

  h1, h2, h3 { font-family: var(--font-display); text-wrap: balance; margin: 0; }

  .eyebrow {
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.11em;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--chrome);
  }

  a { color: var(--chrome); }

  header {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 2rem;
  }

  header h1 {
    font-size: clamp(2rem, 1.6rem + 1.6vw, 2.7rem);
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  header .standfirst {
    max-width: 66ch;
    color: var(--ink-soft);
    font-size: 1.02rem;
  }

  .nameplate {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.6rem;
    margin-top: 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--ink-faint);
  }

  .nameplate b { color: var(--ink-soft); font-weight: 600; }

  section { display: flex; flex-direction: column; gap: 1.15rem; }

  .section-head { display: flex; flex-direction: column; gap: 0.35rem; }
  .section-head h2 { font-size: 1.32rem; font-weight: 600; }
  .section-head p { margin: 0; max-width: 70ch; color: var(--ink-soft); font-size: 0.93rem; }

  .notice {
    background: var(--paper-raised);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.3rem 1.5rem;
    color: var(--ink-soft);
    font-size: 0.95rem;
  }

  .axis-legend {
    max-width: 420px;
    display: grid;
    grid-template-columns: auto 1fr 1fr;
    gap: 0.55rem 1rem;
    background: var(--paper-raised);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.1rem 1.3rem;
    align-items: center;
  }

  .axis-legend .corner { font-size: 0.7rem; color: var(--ink-faint); }
  .axis-legend .col-head, .axis-legend .row-head {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-soft);
    font-weight: 600;
  }
  .axis-legend .col-head { text-align: center; }

  .swatch-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.5rem 0.6rem;
    border-radius: 7px;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 600;
  }
  .swatch-cell .dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; flex: none; }

  .cell-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }

  .cell-card {
    background: var(--paper-raised);
    border: 1px solid var(--border);
    border-left-width: 4px;
    border-radius: 8px;
    padding: 1rem 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .cell-card h3 { font-family: var(--font-mono); font-size: 1rem; font-weight: 600; }

  .cell-card dl {
    margin: 0;
    display: grid;
    grid-template-columns: auto auto;
    gap: 0.15rem 0.6rem;
    font-size: 0.82rem;
  }
  .cell-card dt { color: var(--ink-faint); }
  .cell-card dd {
    margin: 0;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    color: var(--ink-soft);
    text-align: right;
  }

  .cell-nestjs-node { border-left-color: var(--nestjs-node); }
  .cell-nestjs-bun { border-left-color: var(--nestjs-bun); }
  .cell-hono-node { border-left-color: var(--hono-node); }
  .cell-hono-bun { border-left-color: var(--hono-bun); }

  .panel-pair {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
    gap: 1.1rem;
  }

  .panel {
    background: var(--paper-raised);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.2rem 1.35rem 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .panel-title {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ink);
    margin-bottom: 0.65rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .panel-title .vs { color: var(--ink-faint); font-weight: 400; }

  .cmp-row {
    display: grid;
    grid-template-columns: 9.5rem 1fr;
    gap: 0.2rem 1rem;
    padding: 0.7rem 0;
    border-top: 1px solid var(--border-soft);
    align-items: center;
  }
  .cmp-row:first-of-type { border-top: none; }

  .cmp-label { font-size: 0.83rem; color: var(--ink-soft); padding-top: 0.15rem; }

  .cmp-bars { display: flex; flex-direction: column; gap: 0.3rem; }

  .cmp-bar-track {
    position: relative;
    height: 1.15rem;
    background: var(--chrome-soft);
    border-radius: 3px;
    display: flex;
    align-items: center;
  }

  .cmp-bar { height: 100%; border-radius: 3px 0 0 3px; min-width: 2px; }

  .cmp-value {
    margin-left: 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--ink-faint);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .cmp-meta {
    grid-column: 2;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    margin-top: 0.3rem;
    font-size: 0.76rem;
  }

  .floor { font-family: var(--font-mono); color: var(--ink-faint); }

  .pill {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.18rem 0.55rem;
    border-radius: 999px;
    white-space: nowrap;
  }
  .pill-neutral { background: var(--chrome-soft); color: var(--ink-soft); }
  .pill-nestjs-node { background: var(--nestjs-node-bg); color: var(--nestjs-node); }
  .pill-nestjs-bun { background: var(--nestjs-bun-bg); color: var(--nestjs-bun); }
  .pill-hono-node { background: var(--hono-node-bg); color: var(--hono-node); }
  .pill-hono-bun { background: var(--hono-bun-bg); color: var(--hono-bun); }

  .conc-grid, .lc-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(255px, 1fr));
    gap: 1rem;
  }

  .conc-card, .lc-card {
    background: var(--paper-raised);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem 1.2rem 1.2rem;
  }

  .conc-card .level, .lc-card .tokens {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--chrome);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 0.7rem;
    display: block;
  }

  .metric-block + .metric-block { margin-top: 0.9rem; }
  .metric-block .metric-name {
    font-size: 0.7rem;
    color: var(--ink-faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 0.35rem;
    display: block;
  }

  .mini-row {
    display: grid;
    grid-template-columns: 4.6rem 1fr 3.4rem;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.74rem;
    padding: 0.16rem 0;
  }
  .mini-row .mini-label { font-family: var(--font-mono); color: var(--ink-soft); }
  .mini-row .mini-value {
    font-family: var(--font-mono);
    text-align: right;
    color: var(--ink-faint);
    font-variant-numeric: tabular-nums;
  }
  .mini-track { height: 0.55rem; background: var(--chrome-soft); border-radius: 2px; overflow: hidden; }
  .mini-bar { height: 100%; }

  .stability-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.74rem;
    padding: 0.16rem 0;
  }
  .stability-row .mini-label { font-family: var(--font-mono); color: var(--ink-soft); }
  .stability-row .mini-value {
    font-family: var(--font-mono);
    color: var(--ink-faint);
    font-variant-numeric: tabular-nums;
  }

  .limitations {
    background: var(--paper-raised);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.3rem 1.5rem;
  }

  .limitations ul {
    margin: 0.6rem 0 0;
    padding-left: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    color: var(--ink-soft);
    font-size: 0.88rem;
  }

  footer {
    border-top: 1px solid var(--border);
    padding-top: 1.3rem;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--ink-faint);
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.4rem;
  }

  @media (prefers-reduced-motion: no-preference) {
    .cmp-bar, .mini-bar { transition: width 0.5s ease; }
  }
`

const HEAD = `
<meta charset="utf-8">
<title>Framework Overhead</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${STYLE}</style>
`
