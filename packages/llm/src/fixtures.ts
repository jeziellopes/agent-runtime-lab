import type { TokenUsage } from '@arl/contracts'

/**
 * A hand-authored token stream, committed. The contract set carries the literal
 * `authored` as its model; a recorded set pins the real model id at recording
 * time and states it in the report.
 *
 * Under `LLM_MODE=replay`, `MODEL_NAME` selects which fixture set to load, not
 * which model to call.
 */
export interface ReplayFixture {
  agentId: string
  model: string
  /** The selector: matched against the execution's input prompt. */
  prompt: string
  calls: FixtureCall[]
}

/**
 * Keyed by the node that issues the call, not ordered, so the provider is a
 * pure function of the request and holds no cursor.
 */
export interface FixtureCall {
  node: string
  tokens: string[]
  usage: TokenUsage
  failures?: FixtureFailure[]
}

/**
 * `failures[attempt - 1]` is raised instead of the token stream, so retry is
 * observable under replay.
 */
export interface FixtureFailure {
  category: 'agent' | 'provider' | 'tool'
  kind: string
  retryAfterMs?: number
  /**
   * Yield this many tokens, then raise. The only way a failure lands after the
   * SSE headers are sent, which is what the mid-stream assertion needs.
   */
  failAfterTokens?: number
}

export function loadFixture(_agentId: string, _prompt: string): ReplayFixture {
  throw new Error('loadFixture is not implemented')
}
