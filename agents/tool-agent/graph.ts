import type { AgentGraph } from '@arl/contracts'

/**
 * Scenario 03: LLM -> tool selection -> tool execution -> LLM. Entering the
 * tool node is entry to WAITING, observable as `tool.started`.
 *
 * FAKE: the entry and the edges are the real shape; `nodes` is empty. A node
 * belongs here only if `@arl/graph-runtime` can compile and run it.
 */
export const graph: AgentGraph = {
  entry: 'planner',
  nodes: [],
  edges: [
    { from: 'planner', to: 'decision' },
    { from: 'decision', to: 'tool', condition: 'needsTool' },
    { from: 'decision', to: 'response', condition: 'answersDirectly' },
    { from: 'tool', to: 'response' }
  ]
}
