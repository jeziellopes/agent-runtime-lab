import { AgentNotFoundError, ValidationError } from '@arl/contracts'
import { compileGraph } from '@arl/graph-runtime'

import { InMemoryAgentRegistry } from './agent-registry.js'

import type { AgentRegistry } from './agent-registry.js'
import type {
  AgentDefinition,
  ExecutionContext,
  ExecutionRequest
} from '@arl/contracts'
import type { CompiledGraph, GraphDeps, GraphRun } from '@arl/graph-runtime'

/**
 * L3. An execution request resolves to an agent definition, which resolves to a
 * graph, which produces a result. It holds the registry, compiles each graph
 * once at registration, builds the `ExecutionContext` and drives the graph.
 *
 * It writes no execution state and emits no `execution.*` event. What happened
 * is L2's; how it runs is this layer's.
 */
export interface AgentEngine {
  register(definition: AgentDefinition): void
  agents(): readonly AgentDefinition[]
  resolve(request: ExecutionRequest): AgentDefinition
  createContext(
    request: ExecutionRequest,
    executionId: string
  ): ExecutionContext
  run(
    context: ExecutionContext,
    deps: GraphDeps
  ): Promise<Record<string, unknown>>
  stream(context: ExecutionContext, deps: GraphDeps): GraphRun
}

export class DefaultAgentEngine implements AgentEngine {
  private readonly graphs = new Map<string, CompiledGraph>()

  constructor(
    private readonly registry: AgentRegistry = new InMemoryAgentRegistry(),
    private readonly maxIterations: number = 25
  ) {}

  /**
   * Compiles immediately, so a malformed graph fails its registration rather
   * than every request it receives. A cell that boots and then fails everything
   * reports as available, which is worse than an absent cell.
   */
  register(definition: AgentDefinition): void {
    const graph = compileGraph(definition.graph, {
      maxIterations: this.maxIterations
    })

    this.registry.register(definition)
    this.graphs.set(definition.id, graph)
  }

  agents(): readonly AgentDefinition[] {
    return this.registry.list()
  }

  /**
   * Exists so L2 can check before issuing an execution id. `createContext`
   * calls it, so there is one implementation of the check and two ways in.
   */
  resolve(request: ExecutionRequest): AgentDefinition {
    const definition = this.registry.get(request.agentId)

    if (definition === null) {
      throw new AgentNotFoundError(`no agent with the id ${request.agentId}`)
    }

    promptOf(request)

    return definition
  }

  createContext(
    request: ExecutionRequest,
    executionId: string
  ): ExecutionContext {
    this.resolve(request)

    return {
      executionId,
      agentId: request.agentId,
      ...(request.sessionId === undefined
        ? {}
        : { sessionId: request.sessionId }),
      state: { input: promptOf(request) },
      metadata: request.metadata ?? {}
    }
  }

  run(
    context: ExecutionContext,
    deps: GraphDeps
  ): Promise<Record<string, unknown>> {
    return this.graphFor(context).invoke(context, deps)
  }

  /**
   * Forwarded unchanged. A wrapper that renamed or reordered anything would put
   * a second definition of the event sequence between the graph and the golden
   * bytes.
   */
  stream(context: ExecutionContext, deps: GraphDeps): GraphRun {
    return this.graphFor(context).stream(context, deps)
  }

  private graphFor(context: ExecutionContext): CompiledGraph {
    const graph = this.graphs.get(context.agentId)

    if (graph === undefined) {
      throw new AgentNotFoundError(
        `no compiled graph for the agent ${context.agentId}`
      )
    }

    return graph
  }
}

/** `input` is `{ prompt: string }` and is never coerced into one. */
function promptOf(request: ExecutionRequest): string {
  const { input } = request

  if (typeof input !== 'object' || input === null) {
    throw new ValidationError('input must be an object carrying a prompt')
  }

  const { prompt } = input as { prompt?: unknown }

  if (typeof prompt !== 'string' || prompt.length === 0) {
    throw new ValidationError('input.prompt must be a non-empty string')
  }

  return prompt
}
