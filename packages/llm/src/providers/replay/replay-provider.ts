import type {
  LLMChunk,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  Message
} from '@arl/contracts'

/**
 * FAKE: stands in for a live LLM provider — and it is the DEFAULT, not the
 * fallback.
 *
 * It replays a recorded token stream from `fixtures/` with a controlled
 * inter-token delay, so time-to-first-token and token throughput stay
 * measurable while provider variance is removed.
 *
 * Real agent workflows, real tool execution and real streaming transport are
 * still used throughout. Only the model call is replayed.
 */
export class ReplayLLMProvider implements LLMProvider {
  constructor(
    private readonly fixtureSet: string,
    private readonly interTokenDelayMs: number
  ) {}

  generate(_request: LLMRequest): Promise<LLMResponse> {
    throw new Error('ReplayLLMProvider.generate is not implemented')
  }

  stream(_request: LLMRequest): AsyncIterable<LLMChunk> {
    throw new Error('ReplayLLMProvider.stream is not implemented')
  }

  countTokens(_messages: Message[]): Promise<number> {
    throw new Error('ReplayLLMProvider.countTokens is not implemented')
  }

  get fixtures(): string {
    return this.fixtureSet
  }

  get delayMs(): number {
    return this.interTokenDelayMs
  }
}
