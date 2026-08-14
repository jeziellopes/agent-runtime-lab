import type { AgentDefinition } from './agent-definition.js'

/**
 * What `GET /agents` returns. Node and tool identities only, never the objects
 * that carry `execute`, which `JSON.stringify` would drop in silence.
 *
 * The graph is included because the workflow an agent runs is the substance of
 * this project's architectural claim.
 */
export interface AgentSummary {
  id: string
  name: string
  description: string
  tools: string[]
  graph: {
    entry: string
    nodes: string[]
    edges: { from: string; to: string; condition?: string }[]
  }
}

/** One mapping, so the endpoint cannot diverge in shape between adapters. */
export function toAgentSummary(definition: AgentDefinition): AgentSummary {
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    tools: definition.tools.map(tool => tool.name),
    graph: {
      entry: definition.graph.entry,
      nodes: definition.graph.nodes.map(node => node.id),
      edges: definition.graph.edges.map(edge =>
        edge.condition === undefined
          ? { from: edge.from, to: edge.to }
          : { from: edge.from, to: edge.to, condition: edge.condition }
      )
    }
  }
}
