import { definition as concurrentExecutions } from './05-concurrent-executions/definition.js'
import { definition as longContext } from './06-long-context/definition.js'
import { definition as multiStepWorkflow } from './04-multi-step-workflow/definition.js'
import { definition as multipleSessions } from './07-multiple-sessions/definition.js'
import { definition as simpleExecution } from './01-simple-execution/definition.js'
import { definition as streaming } from './02-streaming/definition.js'
import { definition as toolCalling } from './03-tool-calling/definition.js'

import type { ScenarioDefinition } from './types.js'

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

export type { ScenarioDefinition, ScenarioWorkload } from './types.js'
