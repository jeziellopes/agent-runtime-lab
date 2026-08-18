import { AgentError, canTransition } from '@arl/contracts'

import type { Execution, ExecutionStatus } from '@arl/contracts'

/**
 * The store keeps this many most recent executions, evicting oldest first.
 *
 * A stated constant rather than a tuned one. Scenario 05 runs at most 100
 * concurrent, so no live execution is ever evicted; the bound exists so that
 * memory growth measures per-request overhead rather than accumulated history.
 */
export const MAX_EXECUTIONS = 1024

/**
 * Execution state, held in process. There is no persistent backend.
 */
export interface ExecutionStore {
  create(execution: Execution): Promise<void>
  get(id: string): Promise<Execution | null>
  transition(id: string, to: ExecutionStatus): Promise<Execution>
}

export class InMemoryExecutionStore implements ExecutionStore {
  private readonly executions = new Map<string, Execution>()

  create(execution: Execution): Promise<void> {
    return new Promise(resolve => {
      this.executions.set(execution.id, execution)

      if (this.executions.size > MAX_EXECUTIONS) {
        for (const oldest of this.executions.keys()) {
          this.executions.delete(oldest)
          break
        }
      }

      resolve()
    })
  }

  /** An evicted id reads the same as one that never existed. */
  get(id: string): Promise<Execution | null> {
    return Promise.resolve(this.executions.get(id) ?? null)
  }

  /**
   * Rejects a move `canTransition` disallows. The lifecycle is data in
   * `@arl/contracts`; this is the one place that enforces it.
   */
  transition(id: string, to: ExecutionStatus): Promise<Execution> {
    return new Promise(resolve => {
      const execution = this.executions.get(id)

      if (execution === undefined) {
        throw new AgentError(`no execution with the id ${id}`)
      }

      if (!canTransition(execution.status, to)) {
        throw new AgentError(
          `an execution cannot move from ${execution.status} to ${to}`
        )
      }

      const moved: Execution = { ...execution, status: to }

      this.executions.set(id, moved)
      resolve(moved)
    })
  }
}
