export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface Message {
  role: MessageRole
  content: string
}

/**
 * `nodeId` and `attempt` correlate a call with a replay fixture, so the replay
 * provider is a pure function of the request and holds no cursor. Live
 * providers ignore both, and a caller that does not correlate stays valid.
 */
export interface LLMRequest {
  messages: Message[]
  model: string
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
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

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

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
