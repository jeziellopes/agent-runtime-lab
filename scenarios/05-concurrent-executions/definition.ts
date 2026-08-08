import type { ScenarioDefinition } from '../types.js'

/** Behaviour under load */
export const definition: ScenarioDefinition = {
  id: 'concurrent-executions',
  agentId: 'simple-agent',
  measures: 'Behaviour under load',
  measuredRuns: 3
}
