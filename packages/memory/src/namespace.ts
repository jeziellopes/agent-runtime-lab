import { AgentError } from '@arl/contracts'

import type { ExecutionContext } from '@arl/contracts'

/**
 * One exported function rather than a string built at each call site: isolation
 * that depends on every caller formatting the same way is isolation that one
 * caller can end.
 *
 * The prefixes keep the two scopes apart. A `sessionId` equal to some other
 * execution's id would otherwise share that execution's namespace.
 */
export function namespaceFor(context: ExecutionContext): string {
  const { sessionId, executionId } = context

  if (typeof sessionId === 'string' && sessionId.length > 0) {
    return `session:${sessionId}`
  }

  if (typeof executionId !== 'string' || executionId.length === 0) {
    throw new AgentError('an execution context needs an executionId')
  }

  return `execution:${executionId}`
}
