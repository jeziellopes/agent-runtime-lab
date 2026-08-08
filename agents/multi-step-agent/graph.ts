import type { AgentGraph } from '@arl/contracts'

/**
 * Scenario 04: planner -> research -> analysis -> response.
 *
 * FAKE: the entry and the edges are the real shape; `nodes` is empty. A node
 * belongs here only if `@arl/graph-runtime` can compile and run it.
 */
export const graph: AgentGraph = {
  entry: 'planner',
  nodes: [],
  edges: [
    { from: 'planner', to: 'research' },
    { from: 'research', to: 'analysis' },
    { from: 'analysis', to: 'response' }
  ]
}
