import type { ExecutionContext } from './execution.js'
import type { NodeDeps } from './node-deps.js'

/**
 * N -> 1 `AgentDefinition.graph`.
 *
 * The context is data; the collaborators arrive as a second argument, so a
 * context stays comparable between two executions that ran against different
 * provider instances.
 */
export interface AgentNode {
  id: string
  execute(context: ExecutionContext, deps: NodeDeps): Promise<NodeResult>
}

/**
 * Nodes return a partial update, never the state object.
 *
 * `nextNode` selects which outgoing edge is taken; the edge's `condition` is
 * the branch name that selection is reported under.
 */
export interface NodeResult {
  stateUpdate: Record<string, unknown>
  nextNode?: string
}
