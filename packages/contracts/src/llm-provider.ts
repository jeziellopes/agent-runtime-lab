import type { TokenUsage } from '@arl/events'

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface Message {
  role: MessageRole
  content: string
}

/**
 * The four correlation fields select a replay fixture and its call, so the
 * replay provider is a pure function of the request and holds no cursor. Live
 * providers ignore all four, and a caller that does not correlate stays valid.
 *
 * `prompt` is the execution's input prompt verbatim, never the assembled
 * messages: assembled content changes whenever a system prompt does, and a
 * fixture author has no way to reproduce it by hand.
 */
export interface LLMRequest {
  messages: Message[]
  model: string
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
  agentId?: string
  prompt?: string
  nodeId?: string
  attempt?: number
}

export interface LLMResponse {
  content: string
  usage: TokenUsage
}

export interface LLMChunk {
  token: string
  done: boolean
}

/**
 * Defined in `@arl/events` and re-exported here, because `llm.completed`
 * carries the same block and this package depends on that one.
 */
export type { TokenUsage }

/**
 * L7. The replay provider is the default in every benchmark and every test;
 * a live provider sits behind the same interface and is reached
 * only by an explicit flag, to re-record fixtures or verify against a real
 * model.
 *
 * The LLM metrics depend on `countTokens`.
 *
 * On cancellation, `signal` aborts the in-flight provider call and token
 * billing stops. An adapter that reports `CANCELLED` while the call continues
 * is failing the contract.
 */
export interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>
  stream(request: LLMRequest): AsyncIterable<LLMChunk>
  countTokens(messages: Message[]): Promise<number>
}
