import type { AgentGraph, ExecutionContext } from '@arl/contracts'
import type { RuntimeEvent } from '@arl/events'

/**
 * L4. Wraps the `@langchain/langgraph` StateGraph API and nothing above it.
 * The model call goes through the runtime's `LLMProvider`, never through the
 * LangChain model abstraction.
 *
 * Two rules hold here: a graph is compiled once at startup and invoked per
 * request; and `emit`, the provider and the cancel signal are passed through
 * `configurable` rather than captured.
 */
export interface CompiledGraph {
  invoke(context: ExecutionContext, signal: AbortSignal): Promise<unknown>
  stream(
    context: ExecutionContext,
    signal: AbortSignal
  ): AsyncIterable<RuntimeEvent>
}

export function compileGraph(_graph: AgentGraph): CompiledGraph {
  throw new Error('compileGraph is not implemented')
}
