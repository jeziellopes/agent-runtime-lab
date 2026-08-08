import type { AgentGraph } from '@arl/contracts'

/**
 * Scenario 01: client -> runtime -> LLM -> response.
 *
 * FAKE: the entry and the edges are the real shape; `nodes` is empty. A node
 * belongs here only if `@arl/graph-runtime` can compile and run it.
 */
export const graph: AgentGraph = {
  entry: 'llm',
  nodes: [],
  edges: [{ from: 'llm', to: 'response' }]
}
