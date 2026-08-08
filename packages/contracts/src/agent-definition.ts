import type { AgentNode } from './agent-node.js'
import type { Tool } from './tool.js'

/**
 * The workflow an agent executes: nodes and the edges between them. The graph
 * engine that runs it is `@arl/graph-runtime`; nothing here names it.
 */
export interface AgentGraph {
  entry: string
  nodes: readonly AgentNode[]
  edges: readonly AgentEdge[]
}

/**
 * A `condition` makes the edge conditional. Every cycle needs a path that can
 * leave it.
 */
export interface AgentEdge {
  from: string
  to: string
  condition?: string
}

/** 1 -> N `Execution`. Identical in every cell, always. */
export interface AgentDefinition {
  id: string
  name: string
  description: string
  graph: AgentGraph
  tools: Tool[]
}
