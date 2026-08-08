import type { ExecutionContext } from './execution.js'

/**
 * N -> 1 `AgentDefinition.graph`.
 *
 * A node receives the context it is given and reaches outside nothing else.
 */
export interface AgentNode {
  id: string
  execute(context: ExecutionContext): Promise<NodeResult>
}

/** Nodes return a partial update, never the state object. */
export interface NodeResult {
  stateUpdate: Record<string, unknown>
  nextNode?: string
}
