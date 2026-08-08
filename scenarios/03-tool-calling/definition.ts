import type { ScenarioDefinition } from '../types.js'

/** Multi-step execution overhead */
export const definition: ScenarioDefinition = {
  id: 'tool-calling',
  agentId: 'tool-agent',
  measures: 'Multi-step execution overhead',
  measuredRuns: 250
}
