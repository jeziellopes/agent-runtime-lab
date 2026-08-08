import type {
  AgentDefinition,
  AgentRuntime,
  Execution,
  ExecutionRequest,
  ExecutionResult,
  RuntimeConfig
} from '@arl/contracts'
import type { RuntimeEvent } from '@arl/events'

const notImplemented = (method: string): Error =>
  new Error(`AgentRuntimeCore.${method} is not implemented`)

/**
 * L2. Creates executions, manages their lifecycle, drives workflows, emits the
 * twelve runtime events and owns execution state.
 *
 * It imports no HTTP framework and touches no request object; a lint rule over
 * `packages/` enforces that.
 */
export class AgentRuntimeCore implements AgentRuntime {
  constructor(private readonly config: RuntimeConfig) {}

  execute(_request: ExecutionRequest): Promise<ExecutionResult> {
    throw notImplemented('execute')
  }

  stream(_request: ExecutionRequest): AsyncIterable<RuntimeEvent> {
    throw notImplemented('stream')
  }

  getExecution(_id: string): Promise<Execution | null> {
    throw notImplemented('getExecution')
  }

  cancel(_id: string): Promise<void> {
    throw notImplemented('cancel')
  }

  listAgents(): Promise<AgentDefinition[]> {
    throw notImplemented('listAgents')
  }

  /** Identical across all four cells. */
  get runtimeConfig(): RuntimeConfig {
    return this.config
  }
}
