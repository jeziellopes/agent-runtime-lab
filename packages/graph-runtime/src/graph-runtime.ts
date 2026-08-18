import {
  AgentError,
  GraphInvalidError,
  GraphRouteInvalidError,
  MaxIterationsExceededError,
  RuntimeError
} from '@arl/contracts'
import { Command, END, START, StateGraph } from '@langchain/langgraph'

import { createEventQueue } from './event-queue.js'
import { AgentState } from './state.js'
import { outgoing, validateGraph } from './validate.js'

import type { CompileOptions } from './validate.js'
import type {
  AgentEdge,
  AgentGraph,
  AgentNode,
  ExecutionContext,
  NodeDeps,
  NodeResult
} from '@arl/contracts'
import type { RuntimeEvent } from '@arl/events'
import type {
  ExtractStateType,
  ExtractUpdateType,
  LangGraphRunnableConfig
} from '@langchain/langgraph'

export type { CompileOptions }

/** `emit` is added per node, so the caller supplies everything else. */
export type GraphDeps = Omit<NodeDeps, 'emit'>

/**
 * L4. Wraps the `@langchain/langgraph` StateGraph API and nothing above it.
 * The model call goes through `deps.provider`, never through the LangChain
 * model abstraction.
 *
 * Two rules hold here: a graph is compiled once at startup and invoked per
 * request; and `emit`, the provider and the cancel signal are passed through
 * `configurable` rather than captured, so one compiled graph serves any number
 * of concurrent invocations and nothing needs evicting.
 */
export interface CompiledGraph {
  invoke(
    context: ExecutionContext,
    deps: GraphDeps
  ): Promise<Record<string, unknown>>
  stream(
    context: ExecutionContext,
    deps: GraphDeps
  ): AsyncIterable<RuntimeEvent>
}

type State = ExtractStateType<typeof AgentState>
type Update = ExtractUpdateType<typeof AgentState, State>

/** Held at `N = string`, because the node names come from the graph, not the type. */
type Builder = StateGraph<typeof AgentState, State, Update, string>

type Compiled = ReturnType<Builder['compile']>

/** Everything one invocation carries into every node body. */
interface Invocation {
  context: ExecutionContext
  deps: GraphDeps
  emit: (event: RuntimeEvent) => void
  budget: { remaining: number }
}

export function compileGraph(
  graph: AgentGraph,
  options: CompileOptions
): CompiledGraph {
  validateGraph(graph, options)

  let builder: Builder = new StateGraph(AgentState)
  const targets = [...graph.nodes.map(node => node.id), END]

  for (const node of graph.nodes) {
    builder = builder.addNode(node.id, step(graph, node), { ends: targets })
  }

  builder.addEdge(START, graph.entry)

  const compiled = builder.compile()

  return {
    stream(context, deps) {
      return traverse(compiled, context, deps, options).events
    },

    /**
     * Defined as draining `stream`, not as a second traversal: the two paths
     * must emit an identical sequence, and consuming the same iterator makes
     * that structural rather than something two code paths have to agree on.
     */
    async invoke(context, deps) {
      const run = traverse(compiled, context, deps, options)

      for await (const _event of run.events) {
        // The events are the stream's business; invoke wants only the state.
      }

      return run.state()
    }
  }
}

function traverse(
  compiled: Compiled,
  context: ExecutionContext,
  deps: GraphDeps,
  options: CompileOptions
): {
  events: AsyncIterable<RuntimeEvent>
  state: () => Promise<Record<string, unknown>>
} {
  requireDeps(deps)

  const queue = createEventQueue()
  const invocation: Invocation = {
    context,
    deps,
    emit: item => {
      queue.push(item)
    },
    budget: { remaining: options.maxIterations }
  }

  let final: Record<string, unknown> = { ...context.state }

  const settled = compiled
    .invoke(context.state, {
      configurable: { invocation },
      /* One above the budget, so the iteration limit is raised by this runtime
         with its own error rather than by the engine with a different one. */
      recursionLimit: options.maxIterations + 1
    })
    .then(
      reached => {
        final = reached
        queue.close()
      },
      failure => {
        queue.close(failure)
      }
    )

  return {
    events: queue.drain(),
    state: async () => {
      await settled

      return final
    }
  }
}

function requireDeps(deps: GraphDeps): void {
  for (const name of ['provider', 'tools', 'memory', 'signal'] as const) {
    if (deps[name] === undefined || deps[name] === null) {
      throw new GraphInvalidError(`a graph cannot run without deps.${name}`)
    }
  }
}

function step(graph: AgentGraph, node: AgentNode) {
  return async (
    _state: State,
    config: LangGraphRunnableConfig
  ): Promise<Command> => {
    const invocation = config.configurable?.['invocation'] as Invocation

    /* Checked before the node starts, so an aborted traversal emits no further
       `node.started` and stops where it is. A node already running is not
       interrupted: it holds the same signal and passes it on. */
    if (invocation.deps.signal.aborted) {
      return new Command({ goto: END })
    }

    if (invocation.budget.remaining === 0) {
      throw new MaxIterationsExceededError(
        'the graph ran more nodes than maxIterations allows'
      )
    }

    invocation.budget.remaining -= 1
    invocation.emit(started(invocation.context, node.id))

    const result = await execute(node, invocation)
    const edge = route(graph, node.id, result)

    invocation.emit(completed(invocation.context, node.id, edge?.condition))

    return new Command({ update: result.stateUpdate, goto: edge?.to ?? END })
  }
}

async function execute(
  node: AgentNode,
  invocation: Invocation
): Promise<NodeResult> {
  let result: NodeResult

  try {
    result = await node.execute(invocation.context, {
      ...invocation.deps,
      emit: invocation.emit
    })
  } catch (failure) {
    /* A node's own error is never reclassified. Wrapping a ProviderError as
       agent_error would make it unretryable and silently defeat the runtime's
       retry policy. */
    if (failure instanceof RuntimeError) {
      throw failure
    }

    throw new AgentError(
      `${node.id} failed: ${failure instanceof Error ? failure.message : String(failure)}`
    )
  }

  const { stateUpdate } = result

  if (
    typeof stateUpdate !== 'object' ||
    stateUpdate === null ||
    Array.isArray(stateUpdate)
  ) {
    throw new AgentError(
      `${node.id} returned a stateUpdate that is not an object`
    )
  }

  return result
}

/**
 * One unconditional outgoing edge is taken on completion and `nextNode` is
 * ignored. Anything else requires `nextNode` to name an outgoing edge, and a
 * miss is an error rather than a default to the first.
 */
function route(
  graph: AgentGraph,
  from: string,
  result: NodeResult
): AgentEdge | undefined {
  const edges = outgoing(graph, from)
  const [only] = edges

  if (only === undefined) {
    return undefined
  }

  if (edges.length === 1 && only.condition === undefined) {
    return only
  }

  if (result.nextNode === undefined) {
    throw new GraphRouteInvalidError(
      `${from} has ${String(edges.length)} outgoing edges and returned no nextNode`
    )
  }

  const taken = edges.find(edge => edge.to === result.nextNode)

  if (taken === undefined) {
    throw new GraphRouteInvalidError(
      `${from} routed to ${result.nextNode}, which is no outgoing edge of it`
    )
  }

  return taken
}

function started(context: ExecutionContext, node: string): RuntimeEvent {
  return {
    type: 'node.started',
    executionId: context.executionId,
    timestamp: new Date(),
    data: { node }
  }
}

function completed(
  context: ExecutionContext,
  node: string,
  branch: string | undefined
): RuntimeEvent {
  return {
    type: 'node.completed',
    executionId: context.executionId,
    timestamp: new Date(),
    data: { node, ...(branch === undefined ? {} : { branch }) }
  }
}
