import autocannon from 'autocannon'
import { CELLS, baseUrl, findCell } from '@arl/contracts'
import { SCENARIOS, metricsFor, workloadFor } from '@arl/scenarios'

import { BenchmarkError } from './errors.js'
import { captureHost } from './host.js'
import { frameworkOverhead } from './metrics.js'
import { sampleResourceUsage, spawnCell, stopCell } from './process.js'
import { writeResults } from './results-store.js'
import {
  MEASURED_RUNS_LATENCY,
  MEASURED_RUNS_OBSERVATIONAL,
  WARMUP_RUNS,
  distributionOf
} from './statistics.js'

import type {
  Cell,
  ExecutionResult,
  Framework,
  JsRuntime,
  RuntimeMetrics,
  TokenUsage
} from '@arl/contracts'
import type { RuntimeEvent } from '@arl/events'
import type { ScenarioDefinition } from '@arl/scenarios'
import type { Distribution } from './statistics.js'
import type { LLMMetrics, ResourceMetrics, ScenarioResult } from './metrics.js'
import type { SpawnedCell } from './process.js'
import type { CellResults } from './results-store.js'

export interface RunOptions {
  scenario?: string
  framework?: string
  runtime?: string
  host?: string
}

/** What every driver below needs to reach a live cell. */
interface DriveContext {
  host: string
  spawned: ReadonlyMap<string, SpawnedCell>
}

const RESULTS_DIR = 'results'

/**
 * Starts every cell in the resolved matrix through `scripts/start.mjs`,
 * drives the resolved scenarios in interleaved rounds, writes
 * `results/<cell>/metrics.json` per cell, and stops every process it
 * spawned, including when the run throws.
 */
export async function run(options: RunOptions): Promise<CellResults[]> {
  const matrix = resolveMatrix(options)
  const scenarios = resolveScenarios(options.scenario)
  const host = options.host ?? '127.0.0.1'
  const startedAt = new Date().toISOString()
  const { spawned, unavailable } = await spawnMatrix(matrix, host)
  const ctx: DriveContext = { host, spawned }

  try {
    const rows = new Map<string, ScenarioResult[]>(
      matrix.map(cell => [cell.id, []])
    )

    for (const scenario of scenarios) {
      const built = await driveScenario(scenario, matrix, ctx, unavailable)

      for (const [cellId, scenarioRows] of built) {
        rows.get(cellId)?.push(...scenarioRows)
      }
    }

    return await writeAll(matrix, rows, startedAt, spawned)
  } finally {
    for (const cell of spawned.values()) {
      stopCell(cell)
    }
  }
}

async function spawnMatrix(
  matrix: readonly Cell[],
  host: string
): Promise<{
  spawned: Map<string, SpawnedCell>
  unavailable: Map<string, string>
}> {
  const spawned = new Map<string, SpawnedCell>()
  const unavailable = new Map<string, string>()

  await Promise.all(
    matrix.map(async cell => {
      try {
        spawned.set(cell.id, await spawnCell(cell, host))
      } catch (cause) {
        if (!(cause instanceof BenchmarkError)) {
          throw cause
        }

        unavailable.set(cell.id, cause.code)
      }
    })
  )

  return { spawned, unavailable }
}

async function writeAll(
  matrix: readonly Cell[],
  rows: ReadonlyMap<string, ScenarioResult[]>,
  startedAt: string,
  spawned: ReadonlyMap<string, SpawnedCell>
): Promise<CellResults[]> {
  const hostBlock = captureHost()
  const interleavedWith = matrix.map(cell => cell.id)
  const results: CellResults[] = []

  for (const cell of matrix) {
    const cellResults: CellResults = {
      cell: cell.id,
      framework: cell.framework,
      runtime: cell.runtime,
      runtimeVersion:
        cell.runtime === 'node' ? hostBlock.nodeVersion : hostBlock.bunVersion,
      llmMode: 'replay',
      startedAt,
      startupTimeMs: spawned.get(cell.id)?.startupTimeMs ?? 0,
      interleavedWith,
      host: hostBlock,
      scenarios: [...(rows.get(cell.id) ?? [])]
    }

    await writeResults(RESULTS_DIR, cellResults)
    results.push(cellResults)
  }

  return results
}

export function resolveMatrix(options: RunOptions): Cell[] {
  const framework = validatedFramework(options.framework)
  const runtime = validatedRuntime(options.runtime)

  if (framework !== undefined && runtime !== undefined) {
    return [findCell(framework, runtime)]
  }

  return CELLS.filter(
    cell =>
      (framework === undefined || cell.framework === framework) &&
      (runtime === undefined || cell.runtime === runtime)
  )
}

function validatedFramework(value: string | undefined): Framework | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value !== 'nestjs' && value !== 'hono') {
    throw new BenchmarkError('cell_unknown', `no such framework: ${value}`)
  }

  return value
}

function validatedRuntime(value: string | undefined): JsRuntime | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value !== 'node' && value !== 'bun') {
    throw new BenchmarkError('cell_unknown', `no such runtime: ${value}`)
  }

  return value
}

export function resolveScenarios(
  scenarioId: string | undefined
): ScenarioDefinition[] {
  if (scenarioId === undefined) {
    return [...SCENARIOS]
  }

  const found = SCENARIOS.find(scenario => scenario.id === scenarioId)

  if (found === undefined) {
    throw new BenchmarkError(
      'scenario_unknown',
      `no such scenario: ${scenarioId}`
    )
  }

  return [found]
}

/* ---------------------------------------------------------------------- */
/* Driving one scenario across the matrix                                 */
/* ---------------------------------------------------------------------- */

async function driveScenario(
  scenario: ScenarioDefinition,
  matrix: readonly Cell[],
  ctx: DriveContext,
  unavailable: ReadonlyMap<string, string>
): Promise<Map<string, ScenarioResult[]>> {
  const metricNames = metricsFor(scenario.id)

  if (metricNames === undefined) {
    throw new BenchmarkError(
      'scenario_unknown',
      `${scenario.id}: no metrics declared`
    )
  }

  const live = matrix.filter(cell => !unavailable.has(cell.id))
  const results = new Map<string, ScenarioResult[]>()

  for (const cell of matrix) {
    const reason = unavailable.get(cell.id)

    if (reason !== undefined) {
      results.set(cell.id, [unavailableRow(scenario, cell, reason)])
    }
  }

  if (live.length === 0) {
    return results
  }

  const built = await driveLive(scenario, live, ctx, metricNames)

  for (const [cellId, rowsForCell] of built) {
    results.set(cellId, rowsForCell)
  }

  return results
}

function driveLive(
  scenario: ScenarioDefinition,
  live: readonly Cell[],
  ctx: DriveContext,
  metricNames: readonly string[]
): Promise<Map<string, ScenarioResult[]>> {
  if (scenario.id === 'concurrent-executions') {
    return driveConcurrency(scenario, live, ctx, { metricNames })
  }

  if (scenario.id === 'long-context') {
    return driveLongContext(scenario, live, ctx, metricNames)
  }

  if (scenario.id === 'multiple-sessions') {
    return driveSessions(scenario, live, ctx, metricNames)
  }

  return driveUnary(scenario, live, ctx, metricNames)
}

function unavailableRow(
  scenario: ScenarioDefinition,
  cell: Cell,
  reason: string
): ScenarioResult {
  return {
    scenario: scenario.id,
    framework: cell.framework,
    runtime: cell.runtime,
    runtimeVersion: '',
    llmMode: 'replay',
    status: 'unavailable',
    reason,
    warmupRuns: 0,
    runs: 0,
    significanceTested: false,
    errorCount: 0
  }
}

/* ---------------------------------------------------------------------- */
/* The interleaved round driver                                           */
/* ---------------------------------------------------------------------- */

/**
 * Warmup and measured rounds both issue one iteration per cell per round, in
 * `CELLS` declaration order, and the warmup samples are discarded before this
 * returns.
 */
async function interleavedRounds<T>(
  matrix: readonly Cell[],
  warmupRuns: number,
  measuredRuns: number,
  iterate: (cell: Cell) => Promise<T>
): Promise<Map<string, T[]>> {
  const samples = new Map<string, T[]>(matrix.map(cell => [cell.id, []]))

  for (let round = 0; round < warmupRuns + measuredRuns; round += 1) {
    const measured = round >= warmupRuns

    for (const cell of matrix) {
      const sample = await iterate(cell)

      if (measured) {
        samples.get(cell.id)?.push(sample)
      }
    }
  }

  return samples
}

/* ---------------------------------------------------------------------- */
/* Requests                                                                */
/* ---------------------------------------------------------------------- */

interface UnaryRequest {
  agentId: string
  prompt: string
  sessionId?: string
}

interface UnaryIteration {
  requestLatencyMs: number
  ok: boolean
  metrics?: RuntimeMetrics
  usage?: TokenUsage
}

async function executeOnce(
  cell: Cell,
  host: string,
  request: UnaryRequest
): Promise<UnaryIteration> {
  const startedAt = performance.now()

  let response: Response

  try {
    response = await fetch(
      `${baseUrl(cell, host)}/agents/${request.agentId}/execute`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          input: { prompt: request.prompt },
          ...(request.sessionId === undefined
            ? {}
            : { sessionId: request.sessionId })
        })
      }
    )
  } catch {
    return { requestLatencyMs: performance.now() - startedAt, ok: false }
  }

  const requestLatencyMs = performance.now() - startedAt

  if (!response.ok) {
    return { requestLatencyMs, ok: false }
  }

  const result = (await response.json()) as ExecutionResult

  return {
    requestLatencyMs,
    ok: true,
    metrics: result.metrics,
    usage: result.usage
  }
}

interface StreamIteration extends UnaryIteration {
  timeToFirstEventMs?: number
  timeToFirstTokenMs?: number
  droppedEvents: number
}

interface FrameAccumulator {
  firstEventAt?: number
  firstTokenAt?: number
  lastId: number
  droppedEvents: number
  metrics?: RuntimeMetrics
  usage?: TokenUsage
}

/**
 * Reads one SSE response frame by frame, timing the first frame and the
 * first `llm.token` frame against the runner's own clock rather than the
 * event's own `timestamp`, which is the server's clock.
 */
async function streamOnce(
  cell: Cell,
  host: string,
  request: UnaryRequest
): Promise<StreamIteration> {
  const startedAt = performance.now()
  let response: Response

  try {
    response = await fetch(
      `${baseUrl(cell, host)}/agents/${request.agentId}/stream`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: { prompt: request.prompt } })
      }
    )
  } catch {
    return {
      requestLatencyMs: performance.now() - startedAt,
      ok: false,
      droppedEvents: 0
    }
  }

  if (!response.ok || response.body === null) {
    return {
      requestLatencyMs: performance.now() - startedAt,
      ok: false,
      droppedEvents: 0
    }
  }

  const acc: FrameAccumulator = { lastId: 0, droppedEvents: 0 }
  const decoder = new TextDecoder()
  let buffer = ''

  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true })

    let end = buffer.indexOf('\n\n')

    while (end !== -1) {
      readFrame(buffer.slice(0, end), acc)
      buffer = buffer.slice(end + 2)
      end = buffer.indexOf('\n\n')
    }
  }

  return {
    requestLatencyMs: performance.now() - startedAt,
    ok: true,
    timeToFirstEventMs:
      acc.firstEventAt === undefined ? undefined : acc.firstEventAt - startedAt,
    timeToFirstTokenMs:
      acc.firstTokenAt === undefined ? undefined : acc.firstTokenAt - startedAt,
    metrics: acc.metrics,
    usage: acc.usage,
    droppedEvents: acc.droppedEvents
  }
}

function readFrame(frame: string, acc: FrameAccumulator): void {
  const now = performance.now()

  acc.firstEventAt ??= now

  const lines = frame.split('\n')
  const idLine = lines.find(line => line.startsWith('id: '))
  const eventLine = lines.find(line => line.startsWith('event: '))
  const dataLine = lines.find(line => line.startsWith('data: '))

  if (idLine !== undefined) {
    const id = Number(idLine.slice(4))

    if (acc.lastId > 0 && id > acc.lastId + 1) {
      acc.droppedEvents += id - acc.lastId - 1
    }

    acc.lastId = id
  }

  if (eventLine?.slice(7) === 'llm.token') {
    acc.firstTokenAt ??= now
  }

  if (dataLine === undefined) {
    return
  }

  const event = JSON.parse(dataLine.slice(6)) as RuntimeEvent

  if (event.type === 'llm.completed') {
    acc.usage = addUsage(acc.usage, event.data.usage)
  }

  if (event.type === 'execution.completed') {
    acc.metrics = event.data.metrics
  }
}

function addUsage(
  current: TokenUsage | undefined,
  next: TokenUsage
): TokenUsage {
  return {
    inputTokens: (current?.inputTokens ?? 0) + next.inputTokens,
    outputTokens: (current?.outputTokens ?? 0) + next.outputTokens,
    totalTokens: (current?.totalTokens ?? 0) + next.totalTokens
  }
}

/**
 * `metrics_absent` when every successful sample carries no `RuntimeMetrics`,
 * distinct from `deterministic_mode`, which the cell's own `DETERMINISTIC`
 * environment (forwarded to it at spawn) already explains.
 */
function metricsAbsentReason(
  samples: readonly (UnaryIteration | StreamIteration)[]
): string | undefined {
  const ok = samples.filter(sample => sample.ok)

  if (ok.length === 0 || ok.some(sample => sample.metrics !== undefined)) {
    return undefined
  }

  return process.env['DETERMINISTIC'] === 'true'
    ? 'deterministic_mode'
    : 'metrics_absent'
}

/* ---------------------------------------------------------------------- */
/* Scenarios 01, 02, 03, 04: one row, interleaved rounds                  */
/* ---------------------------------------------------------------------- */

async function driveUnary(
  scenario: ScenarioDefinition,
  matrix: readonly Cell[],
  ctx: DriveContext,
  metricNames: readonly string[]
): Promise<Map<string, ScenarioResult[]>> {
  const workload = workloadFor(scenario.id)

  if (workload === undefined) {
    throw new BenchmarkError('scenario_unknown', `${scenario.id}: no workload`)
  }

  const streaming = workload.streaming === true
  const request: UnaryRequest = {
    agentId: scenario.agentId,
    prompt: workload.prompt
  }
  const samples = await interleavedRounds<UnaryIteration | StreamIteration>(
    matrix,
    WARMUP_RUNS,
    MEASURED_RUNS_LATENCY,
    cell =>
      streaming
        ? streamOnce(cell, ctx.host, request)
        : executeOnce(cell, ctx.host, request)
  )

  const rows = new Map<string, ScenarioResult[]>()

  for (const cell of matrix) {
    const resource = await sampleResourceUsage(
      ctx.spawned.get(cell.id)?.pid ?? -1
    )

    rows.set(cell.id, [
      buildLatencyRow(scenario, cell, samples.get(cell.id) ?? [], {
        resource,
        metricNames,
        streaming
      })
    ])
  }

  return rows
}

interface LatencyRowOptions {
  resource: ResourceMetrics
  metricNames: readonly string[]
  streaming: boolean
}

function buildLatencyRow(
  scenario: ScenarioDefinition,
  cell: Cell,
  samples: readonly (UnaryIteration | StreamIteration)[],
  options: LatencyRowOptions
): ScenarioResult {
  const missingMetrics = metricsAbsentReason(samples)

  if (missingMetrics !== undefined) {
    return unavailableRow(scenario, cell, missingMetrics)
  }

  const ok = samples.filter(sample => sample.ok)
  const errorCount = samples.length - ok.length
  const latencyMs = distributionOf(ok.map(sample => sample.requestLatencyMs))
  const executionDurationMs = distributionOf(
    numbers(ok, sample => sample.metrics?.executionDuration)
  )
  const frameworkOverheadMs = options.streaming
    ? undefined
    : distributionOf(
        ok
          .filter(sample => sample.metrics !== undefined)
          .map(sample => overheadOf(sample))
      )
  const scenarioMetrics = scenarioMetricsFor({
    scenarioId: scenario.id,
    ok,
    resource: options.resource,
    latencyMs,
    executionDurationMs,
    errorCount,
    runs: samples.length,
    metricNames: options.metricNames
  })
  const llm = llmMetricsOf(ok)

  return {
    scenario: scenario.id,
    framework: cell.framework,
    runtime: cell.runtime,
    runtimeVersion: '',
    llmMode: 'replay',
    status: 'ok',
    warmupRuns: WARMUP_RUNS,
    runs: samples.length,
    significanceTested: true,
    errorCount,
    latencyMs,
    ...(frameworkOverheadMs === undefined ? {} : { frameworkOverheadMs }),
    executionDurationMs,
    resource: options.resource,
    ...(llm === undefined ? {} : { llm }),
    scenarioMetrics
  }
}

function overheadOf(sample: UnaryIteration | StreamIteration): number {
  return frameworkOverhead(
    {
      startupTime: 0,
      requestLatency: sample.requestLatencyMs,
      responseTime: sample.requestLatencyMs,
      errorCount: 0,
      activeRequests: 1
    },
    sample.metrics as RuntimeMetrics
  )
}

function numbers<T>(
  samples: readonly T[],
  select: (sample: T) => number | undefined
): number[] {
  return samples
    .map(select)
    .filter((value): value is number => value !== undefined)
}

function llmMetricsOf(
  samples: readonly (UnaryIteration | StreamIteration)[]
): LLMMetrics | undefined {
  const withUsage = samples.filter(sample => sample.usage !== undefined)
  const last = withUsage[withUsage.length - 1]

  if (last?.usage === undefined) {
    return undefined
  }

  const timeToFirstToken = numbers(
    withUsage,
    sample => (sample as StreamIteration).timeToFirstTokenMs
  )

  return {
    inputTokens: last.usage.inputTokens,
    outputTokens: last.usage.outputTokens,
    totalTokens: last.usage.totalTokens,
    estimatedCost: 0,
    timeToFirstToken:
      timeToFirstToken.length === 0 ? 0 : average(timeToFirstToken)
  }
}

/* ---------------------------------------------------------------------- */
/* scenarioMetrics, one small builder per scenario                        */
/* ---------------------------------------------------------------------- */

interface ScenarioMetricsInput {
  scenarioId: string
  ok: readonly (UnaryIteration | StreamIteration)[]
  resource: ResourceMetrics
  latencyMs: Distribution
  executionDurationMs: Distribution
  errorCount: number
  runs: number
  metricNames: readonly string[]
}

const SCENARIO_METRIC_BUILDERS: Readonly<
  Record<
    string,
    (
      input: ScenarioMetricsInput
    ) => Record<string, Distribution | number | boolean>
  >
> = {
  'simple-execution': simpleExecutionMetrics,
  streaming: streamingMetrics,
  'tool-calling': toolCallingMetrics,
  'multi-step-workflow': multiStepMetrics,
  'long-context': longContextMetrics
}

function scenarioMetricsFor(
  input: ScenarioMetricsInput
): Record<string, Distribution | number | boolean> {
  const build = SCENARIO_METRIC_BUILDERS[input.scenarioId]
  const values = build === undefined ? {} : build(input)

  assertKeysMatch(input.scenarioId, values, input.metricNames)

  return values
}

function simpleExecutionMetrics(
  input: ScenarioMetricsInput
): Record<string, Distribution | number> {
  return {
    total_latency: input.latencyMs,
    framework_overhead: distributionOf(
      input.ok.filter(sample => sample.metrics !== undefined).map(overheadOf)
    ),
    runtime_time: input.executionDurationMs,
    memory: input.resource.memoryMb,
    cpu: input.resource.cpuPercent
  }
}

function streamingMetrics(
  input: ScenarioMetricsInput
): Record<string, Distribution | number> {
  const streamSamples = input.ok as readonly StreamIteration[]

  return {
    time_to_first_event: distributionOf(
      numbers(streamSamples, s => s.timeToFirstEventMs)
    ),
    time_to_first_token: distributionOf(
      numbers(streamSamples, s => s.timeToFirstTokenMs)
    ),
    token_throughput: distributionOf(
      streamSamples
        .filter(sample => sample.usage !== undefined)
        .map(
          sample =>
            (sample.usage?.outputTokens ?? 0) /
            Math.max(sample.requestLatencyMs / 1000, 0.001)
        )
    ),
    connection_duration: input.latencyMs,
    dropped_events: streamSamples.reduce(
      (total, sample) => total + sample.droppedEvents,
      0
    )
  }
}

function toolCallingMetrics(
  input: ScenarioMetricsInput
): Record<string, Distribution | number> {
  return {
    total_duration: input.latencyMs,
    tool_execution_time: distributionOf(
      numbers(input.ok, s => s.metrics?.nodeDuration)
    ),
    event_count: distributionOf(
      numbers(input.ok, s => s.metrics?.eventsGenerated)
    ),
    error_rate: input.runs === 0 ? 0 : input.errorCount / input.runs
  }
}

function multiStepMetrics(
  input: ScenarioMetricsInput
): Record<string, Distribution> {
  return {
    node_transition_latency: distributionOf(
      numbers(input.ok, s => s.metrics?.nodeDuration)
    ),
    state_update_latency: distributionOf(
      numbers(input.ok, s =>
        s.metrics === undefined
          ? undefined
          : s.metrics.graphDuration - s.metrics.nodeDuration
      )
    ),
    total_time: input.executionDurationMs
  }
}

function longContextMetrics(
  input: ScenarioMetricsInput
): Record<string, Distribution | number | boolean> {
  return {
    duration: input.executionDurationMs,
    memory: input.resource.memoryMb,
    token_processing_time: distributionOf(
      numbers(input.ok, s => s.metrics?.graphDuration)
    ),
    streaming_stability: input.errorCount === 0
  }
}

/**
 * `metrics.ts` declares the metric names a scenario's row must carry, and the
 * runner asserts key equality against that array rather than trusting it.
 */
function assertKeysMatch(
  scenarioId: string,
  values: Record<string, unknown>,
  metricNames: readonly string[]
): void {
  const missing = metricNames.filter(name => !(name in values))
  const extra = Object.keys(values).filter(name => !metricNames.includes(name))

  if (missing.length > 0 || extra.length > 0) {
    throw new BenchmarkError(
      'results_incomplete',
      `${scenarioId}: scenarioMetrics keys differ from the declared names (missing ${missing.join(',')}, extra ${extra.join(',')})`
    )
  }
}

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length
}

/* ---------------------------------------------------------------------- */
/* Scenario 06: long context, one row per synthetic length                */
/* ---------------------------------------------------------------------- */

async function driveLongContext(
  scenario: ScenarioDefinition,
  matrix: readonly Cell[],
  ctx: DriveContext,
  metricNames: readonly string[]
): Promise<Map<string, ScenarioResult[]>> {
  const workload = workloadFor(scenario.id)

  if (
    workload?.syntheticTokens === undefined ||
    workload.syntheticPrompts === undefined
  ) {
    throw new BenchmarkError(
      'scenario_unknown',
      `${scenario.id}: no synthetic variants declared`
    )
  }

  const rows = new Map<string, ScenarioResult[]>(
    matrix.map(cell => [cell.id, []])
  )

  for (const [index, tokens] of workload.syntheticTokens.entries()) {
    const built = await driveLongContextVariant(scenario, matrix, {
      ctx,
      metricNames,
      variant: {
        tokens,
        prompt: promptForVariant(
          scenario.id,
          workload.syntheticPrompts,
          index,
          tokens
        )
      }
    })

    appendRows(rows, built)
  }

  return rows
}

function promptForVariant(
  scenarioId: string,
  prompts: readonly string[],
  index: number,
  tokens: number
): string {
  const prompt = prompts[index]

  if (prompt === undefined) {
    throw new BenchmarkError(
      'scenario_unknown',
      `${scenarioId}: no prompt declared for the ${String(tokens)}-token variant`
    )
  }

  return prompt
}

function appendRows(
  rows: Map<string, ScenarioResult[]>,
  built: ReadonlyMap<string, ScenarioResult[]>
): void {
  for (const [cellId, cellRows] of built) {
    rows.get(cellId)?.push(...cellRows)
  }
}

interface LongContextVariantOptions {
  ctx: DriveContext
  metricNames: readonly string[]
  variant: { tokens: number; prompt: string }
}

async function driveLongContextVariant(
  scenario: ScenarioDefinition,
  matrix: readonly Cell[],
  options: LongContextVariantOptions
): Promise<Map<string, ScenarioResult[]>> {
  const { ctx, metricNames, variant } = options
  const request: UnaryRequest = {
    agentId: scenario.agentId,
    prompt: variant.prompt
  }
  const samples = await interleavedRounds<UnaryIteration>(
    matrix,
    WARMUP_RUNS,
    MEASURED_RUNS_OBSERVATIONAL,
    cell => executeOnce(cell, ctx.host, request)
  )

  const rows = new Map<string, ScenarioResult[]>()

  for (const cell of matrix) {
    const resource = await sampleResourceUsage(
      ctx.spawned.get(cell.id)?.pid ?? -1
    )
    const row = buildLatencyRow(scenario, cell, samples.get(cell.id) ?? [], {
      resource,
      metricNames,
      streaming: false
    })

    rows.set(cell.id, [
      {
        ...row,
        variant: `${String(variant.tokens)}-tokens`,
        significanceTested: false
      }
    ])
  }

  return rows
}

/* ---------------------------------------------------------------------- */
/* Scenario 07: two interleaved sessions                                  */
/* ---------------------------------------------------------------------- */

interface SessionIteration {
  requestLatencyMs: number
  isolated: boolean
}

async function driveSessions(
  scenario: ScenarioDefinition,
  matrix: readonly Cell[],
  ctx: DriveContext,
  metricNames: readonly string[]
): Promise<Map<string, ScenarioResult[]>> {
  const workload = workloadFor(scenario.id)

  if (workload === undefined) {
    throw new BenchmarkError('scenario_unknown', `${scenario.id}: no workload`)
  }

  const samples = await interleavedRounds<SessionIteration>(
    matrix,
    WARMUP_RUNS,
    MEASURED_RUNS_LATENCY,
    cell => sessionIteration(cell, ctx.host, scenario.agentId, workload.prompt)
  )

  const rows = new Map<string, ScenarioResult[]>()

  for (const cell of matrix) {
    rows.set(cell.id, [
      await buildSessionRow(scenario, cell, {
        samples: samples.get(cell.id) ?? [],
        ctx,
        metricNames
      })
    ])
  }

  return rows
}

async function sessionIteration(
  cell: Cell,
  host: string,
  agentId: string,
  prompt: string
): Promise<SessionIteration> {
  const startedAt = performance.now()
  const [a, b] = await Promise.all([
    executeOnce(cell, host, { agentId, prompt, sessionId: 'session-a' }),
    executeOnce(cell, host, { agentId, prompt, sessionId: 'session-b' })
  ])

  return {
    requestLatencyMs: performance.now() - startedAt,
    isolated: a.ok && b.ok
  }
}

interface SessionRowOptions {
  samples: readonly SessionIteration[]
  ctx: DriveContext
  metricNames: readonly string[]
}

async function buildSessionRow(
  scenario: ScenarioDefinition,
  cell: Cell,
  options: SessionRowOptions
): Promise<ScenarioResult> {
  const { samples, ctx, metricNames } = options
  const errorCount = samples.filter(sample => !sample.isolated).length
  const resource = await sampleResourceUsage(
    ctx.spawned.get(cell.id)?.pid ?? -1
  )
  const executionDurationMs = distributionOf(
    samples.map(sample => sample.requestLatencyMs)
  )
  const scenarioMetrics: Record<string, Distribution | number | boolean> = {
    session_isolation: errorCount === 0,
    memory_lookup_latency: executionDurationMs,
    persistence_performance: executionDurationMs
  }

  assertKeysMatch(scenario.id, scenarioMetrics, metricNames)

  return {
    scenario: scenario.id,
    framework: cell.framework,
    runtime: cell.runtime,
    runtimeVersion: '',
    llmMode: 'replay',
    status: 'ok',
    warmupRuns: WARMUP_RUNS,
    runs: samples.length,
    significanceTested: true,
    errorCount,
    executionDurationMs,
    resource,
    scenarioMetrics
  }
}

/* ---------------------------------------------------------------------- */
/* Scenario 05: concurrency, driven by autocannon                         */
/* ---------------------------------------------------------------------- */

const AUTOCANNON_REPEATS = 3
const AUTOCANNON_DURATION_S = 10

interface ConcurrencyOptions {
  metricNames: readonly string[]
  durationS?: number
}

export async function driveConcurrency(
  scenario: ScenarioDefinition,
  matrix: readonly Cell[],
  ctx: DriveContext,
  options: ConcurrencyOptions
): Promise<Map<string, ScenarioResult[]>> {
  const workload = workloadFor(scenario.id)

  if (workload === undefined || !Array.isArray(workload.concurrency)) {
    throw new BenchmarkError(
      'scenario_unknown',
      `${scenario.id}: no concurrency levels declared`
    )
  }

  const rows = new Map<string, ScenarioResult[]>(
    matrix.map(cell => [cell.id, []])
  )
  const durationS = options.durationS ?? AUTOCANNON_DURATION_S

  for (const level of workload.concurrency) {
    for (const cell of matrix) {
      const runs = await autocannonRuns({
        cell,
        host: ctx.host,
        agentId: scenario.agentId,
        prompt: workload.prompt,
        level,
        durationS
      })
      const resource = await sampleResourceUsage(
        ctx.spawned.get(cell.id)?.pid ?? -1
      )

      rows.get(cell.id)?.push(
        buildConcurrencyRow(scenario, cell, {
          level,
          runs,
          resource,
          metricNames: options.metricNames
        })
      )
    }
  }

  return rows
}

interface AutocannonRunOptions {
  cell: Cell
  host: string
  agentId: string
  prompt: string
  level: number
  durationS: number
}

async function autocannonRuns(
  options: AutocannonRunOptions
): Promise<autocannon.Result[]> {
  const { cell, host, agentId, prompt, level, durationS } = options
  const runs: autocannon.Result[] = []

  for (let repeat = 0; repeat < AUTOCANNON_REPEATS; repeat += 1) {
    runs.push(
      await autocannon({
        url: `${baseUrl(cell, host)}/agents/${agentId}/execute`,
        connections: level,
        duration: durationS,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: { prompt } })
      })
    )
  }

  return runs
}

interface ConcurrencyRowOptions {
  level: number
  runs: readonly autocannon.Result[]
  resource: ResourceMetrics
  metricNames: readonly string[]
}

export function buildConcurrencyRow(
  scenario: ScenarioDefinition,
  cell: Cell,
  options: ConcurrencyRowOptions
): ScenarioResult {
  const { runs } = options
  const totalSent = runs.reduce((total, run) => total + run.requests.sent, 0)
  const totalErrors = runs.reduce(
    (total, run) => total + run.errors + run.non2xx,
    0
  )
  const scenarioMetrics: Record<string, Distribution | number | boolean> = {
    rps: average(runs.map(run => run.requests.average)),
    mean_latency: average(runs.map(run => run.latency.average)),
    p95_latency: average(runs.map(run => run.latency.p97_5)),
    p99_latency: average(runs.map(run => run.latency.p99)),
    error_rate: totalSent === 0 ? 0 : totalErrors / totalSent,
    memory_growth: options.resource.memoryMb
  }

  assertKeysMatch(scenario.id, scenarioMetrics, options.metricNames)

  return {
    scenario: scenario.id,
    variant: `${String(options.level)}-concurrent`,
    framework: cell.framework,
    runtime: cell.runtime,
    runtimeVersion: '',
    llmMode: 'replay',
    status: 'ok',
    warmupRuns: 0,
    runs: runs.length,
    significanceTested: false,
    errorCount: totalErrors,
    resource: options.resource,
    scenarioMetrics
  }
}
