import type { RuntimeMetrics } from '@arl/contracts'

import type { Distribution } from './statistics.js'

/**
 * The four families collected per run. Three are observed here; the runtime
 * family travels on the response, because a client cannot see inside an
 * execution and a wall clock cannot resolve the difference.
 */
export interface ApplicationMetrics {
  startupTime: number
  requestLatency: number
  responseTime: number
  errorCount: number
  activeRequests: number
}

export interface LLMMetrics {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCost: number
  timeToFirstToken: number
}

export interface ResourceMetrics {
  cpuPercent: number
  memoryMb: number
  heapMb: number
  startupTimeMs: number
}

/**
 * Framework overhead is `request_latency - execution_duration`: wall time
 * inside the adapter that the runtime did not account for.
 */
export function frameworkOverhead(
  _application: ApplicationMetrics,
  _runtime: RuntimeMetrics
): number {
  throw new Error('frameworkOverhead is not implemented')
}

/**
 * One result row. Every result carries `runtime`, `llmMode`, `runs` and a
 * distribution — a bare number with no run count is not a result and the report
 * must not print one.
 *
 * A cell that could not be built or run records `status: "unavailable"` with
 * the reason.
 */
export interface ScenarioResult {
  framework: 'nestjs' | 'hono'
  runtime: 'node' | 'bun'
  runtimeVersion: string
  scenario: string
  llmMode: 'replay' | 'live'
  runs: number
  status: 'ok' | 'unavailable'
  reason?: string
  latencyMs?: Distribution
  memoryMb?: number
  tokens?: number
}
