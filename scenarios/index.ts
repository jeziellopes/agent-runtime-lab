import { definition as concurrentExecutions } from './05-concurrent-executions/definition.js'
import { workload as concurrentExecutionsWorkload } from './05-concurrent-executions/workload.js'
import { metrics as concurrentExecutionsMetrics } from './05-concurrent-executions/metrics.js'
import { definition as longContext } from './06-long-context/definition.js'
import { workload as longContextWorkload } from './06-long-context/workload.js'
import { metrics as longContextMetrics } from './06-long-context/metrics.js'
import { definition as multiStepWorkflow } from './04-multi-step-workflow/definition.js'
import { workload as multiStepWorkflowWorkload } from './04-multi-step-workflow/workload.js'
import { metrics as multiStepWorkflowMetrics } from './04-multi-step-workflow/metrics.js'
import { definition as multipleSessions } from './07-multiple-sessions/definition.js'
import { workload as multipleSessionsWorkload } from './07-multiple-sessions/workload.js'
import { metrics as multipleSessionsMetrics } from './07-multiple-sessions/metrics.js'
import { definition as simpleExecution } from './01-simple-execution/definition.js'
import { workload as simpleExecutionWorkload } from './01-simple-execution/workload.js'
import { metrics as simpleExecutionMetrics } from './01-simple-execution/metrics.js'
import { definition as streaming } from './02-streaming/definition.js'
import { workload as streamingWorkload } from './02-streaming/workload.js'
import { metrics as streamingMetrics } from './02-streaming/metrics.js'
import { definition as toolCalling } from './03-tool-calling/definition.js'
import { workload as toolCallingWorkload } from './03-tool-calling/workload.js'
import { metrics as toolCallingMetrics } from './03-tool-calling/metrics.js'

import type { ScenarioDefinition, ScenarioWorkload } from './types.js'

/**
 * The seven scenarios, in numbered order. Every one runs against every cell,
 * unchanged; a scenario is never adapted to a cell.
 */
export const SCENARIOS: readonly ScenarioDefinition[] = [
  simpleExecution,
  streaming,
  toolCalling,
  multiStepWorkflow,
  concurrentExecutions,
  longContext,
  multipleSessions
]

const WORKLOADS: Readonly<Record<string, ScenarioWorkload>> = {
  [simpleExecution.id]: simpleExecutionWorkload,
  [streaming.id]: streamingWorkload,
  [toolCalling.id]: toolCallingWorkload,
  [multiStepWorkflow.id]: multiStepWorkflowWorkload,
  [concurrentExecutions.id]: concurrentExecutionsWorkload,
  [longContext.id]: longContextWorkload,
  [multipleSessions.id]: multipleSessionsWorkload
}

const METRICS: Readonly<Record<string, readonly string[]>> = {
  [simpleExecution.id]: simpleExecutionMetrics,
  [streaming.id]: streamingMetrics,
  [toolCalling.id]: toolCallingMetrics,
  [multiStepWorkflow.id]: multiStepWorkflowMetrics,
  [concurrentExecutions.id]: concurrentExecutionsMetrics,
  [longContext.id]: longContextMetrics,
  [multipleSessions.id]: multipleSessionsMetrics
}

export function workloadFor(scenarioId: string): ScenarioWorkload | undefined {
  return WORKLOADS[scenarioId]
}

export function metricsFor(scenarioId: string): readonly string[] | undefined {
  return METRICS[scenarioId]
}

export type { ScenarioDefinition, ScenarioWorkload } from './types.js'
