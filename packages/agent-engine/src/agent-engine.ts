import type { ExecutionContext, ExecutionRequest } from '@arl/contracts'

/**
 * L3. An execution request resolves to an agent definition, which resolves to a
 * graph, which produces a result. Loads definitions, starts workflows, manages
 * execution context and coordinates the graph engine.
 */
export interface AgentEngine {
  createContext(request: ExecutionRequest): ExecutionContext
  run(context: ExecutionContext): Promise<unknown>
}

export class DefaultAgentEngine implements AgentEngine {
  createContext(_request: ExecutionRequest): ExecutionContext {
    throw new Error('DefaultAgentEngine.createContext is not implemented')
  }

  run(_context: ExecutionContext): Promise<unknown> {
    throw new Error('DefaultAgentEngine.run is not implemented')
  }
}
