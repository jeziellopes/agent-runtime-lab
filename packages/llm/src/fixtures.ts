/**
 * A recorded token stream, committed. The recording model is pinned at
 * recording time and stated in the report (`MODEL_NAME`); under
 * `LLM_MODE=replay` that variable selects which fixture set to load, not which
 * model to call.
 */
export interface TokenStreamFixture {
  /** The agent this was recorded for. */
  agentId: string
  /** Pinned at recording time. */
  model: string
  prompt: string
  tokens: string[]
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

export function loadFixture(_agentId: string): TokenStreamFixture {
  throw new Error('loadFixture is not implemented')
}
