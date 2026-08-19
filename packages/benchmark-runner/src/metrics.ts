import type {
  Framework,
  JsRuntime,
  LLMMode,
  RuntimeMetrics
} from '@arl/contracts'

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
 * inside the adapter that the runtime did not account for. Returns a negative
 * number rather than clamping when the runtime reports longer than the client
 * observed.
 */
export function frameworkOverhead(
  application: ApplicationMetrics,
  runtime: RuntimeMetrics
): number {
  return application.requestLatency - runtime.executionDuration
}

/**
 * One result row. Every row repeats `framework`, `runtime`, `runtimeVersion`
 * and `llmMode`, so a row quoted on its own is still a result.
 *
 * A cell that could not be built or run records `status: "unavailable"` with
 * the reason.
 */
export interface ScenarioResult {
  scenario: string
  variant?: string
  framework: Framework
  runtime: JsRuntime
  runtimeVersion: string
  llmMode: LLMMode
  status: 'ok' | 'unavailable'
  reason?: string
  warmupRuns: number
  runs: number
  significanceTested: boolean
  errorCount: number
  latencyMs?: Distribution
  frameworkOverheadMs?: Distribution
  executionDurationMs?: Distribution
  resource?: ResourceMetrics
  llm?: LLMMetrics
  scenarioMetrics?: Record<string, Distribution | number | boolean>
}
