import type { ScenarioDefinition } from '../types.js'

/** Baseline adapter overhead */
export const definition: ScenarioDefinition = {
  id: 'simple-execution',
  agentId: 'simple-agent',
  measures: 'Baseline adapter overhead',
  measuredRuns: 250
}
