import type { Execution, ExecutionStatus } from '@arl/contracts'

/**
 * Execution state, held in process. There is no persistent backend.
 */
export interface ExecutionStore {
  create(execution: Execution): Promise<void>
  get(id: string): Promise<Execution | null>
  transition(id: string, to: ExecutionStatus): Promise<Execution>
}

export class InMemoryExecutionStore implements ExecutionStore {
  create(_execution: Execution): Promise<void> {
    throw new Error('InMemoryExecutionStore.create is not implemented')
  }

  get(_id: string): Promise<Execution | null> {
    throw new Error('InMemoryExecutionStore.get is not implemented')
  }

  /**
   * Rejects a move `canTransition` disallows. The lifecycle is data in
   * `@arl/contracts`; this is the one place that enforces it.
   */
  transition(_id: string, _to: ExecutionStatus): Promise<Execution> {
    throw new Error('InMemoryExecutionStore.transition is not implemented')
  }
}
