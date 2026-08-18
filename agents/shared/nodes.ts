import type {
  AgentNode,
  ExecutionContext,
  Message,
  NodeDeps
} from '@arl/contracts'

/**
 * The execution prompt, verbatim. The engine seeds `input` and no node
 * overwrites it, so every step reads the same string.
 */
export function promptOf(context: ExecutionContext): string {
  return String(context.state['input'])
}

/** What the last model call left. `response` decides what the client sees. */
export function answerOf(context: ExecutionContext): string {
  return String(context.state['output'])
}

export function toolResultsOf(context: ExecutionContext): readonly unknown[] {
  return context.state['toolResults'] as readonly unknown[]
}

export function messagesFor(system: string, user: string): Message[] {
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ]
}

/**
 * The one place a reference agent calls the model. Five nodes across three
 * agents emit the same three event kinds in the same order, and the goldens
 * encode that order as bytes, so it is one implementation rather than five.
 */
export async function callModel(
  node: string,
  messages: Message[],
  context: ExecutionContext,
  deps: NodeDeps
): Promise<string> {
  const { executionId } = context
  const prompt = promptOf(context)

  deps.emit({
    type: 'llm.started',
    executionId,
    data: { node, model: deps.model }
  })

  const tokens: string[] = []

  for await (const chunk of deps.provider.stream({
    messages,
    model: deps.model,
    signal: deps.signal,
    agentId: context.agentId,
    prompt,
    nodeId: node
  })) {
    tokens.push(chunk.token)
    deps.emit({ type: 'llm.token', executionId, data: { token: chunk.token } })
  }

  /* Counted over the execution prompt rather than the assembled messages: a
     fixture author has to reproduce the number by hand, and assembled content
     changes whenever a system prompt does. */
  const inputTokens = await deps.provider.countTokens([
    { role: 'user', content: prompt }
  ])

  deps.emit({
    type: 'llm.completed',
    executionId,
    data: {
      node,
      usage: {
        inputTokens,
        outputTokens: tokens.length,
        totalTokens: inputTokens + tokens.length
      }
    }
  })

  return tokens.join('')
}

/** A node whose whole job is one model call. */
export function llmNode(
  id: string,
  build: (context: ExecutionContext) => Message[]
): AgentNode {
  return {
    id,
    execute: async (context, deps) => ({
      stateUpdate: {
        output: await callModel(id, build(context), context, deps)
      }
    })
  }
}

/**
 * The graph's exit, and the only node whose `output` the client is promised.
 * The model-calling nodes before it write theirs as they go.
 */
export function respondNode(id: string): AgentNode {
  return {
    id,
    execute: context =>
      Promise.resolve({ stateUpdate: { output: answerOf(context).trim() } })
  }
}
