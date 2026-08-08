import type {
  LLMChunk,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  Message
} from '@arl/contracts'

/**
 * Live provider, reached only under `LLM_MODE=live`: an explicit flag, used
 * to re-record fixtures and to verify the runtime against a real model. It is
 * never on the benchmark path, and day-to-day development needs no
 * API key at all.
 *
 * Any published number produced live must state provider, model and run count.
 */
export class OpenaiProvider implements LLMProvider {
  generate(_request: LLMRequest): Promise<LLMResponse> {
    throw new Error('OpenaiProvider.generate is not implemented')
  }

  stream(_request: LLMRequest): AsyncIterable<LLMChunk> {
    throw new Error('OpenaiProvider.stream is not implemented')
  }

  countTokens(_messages: Message[]): Promise<number> {
    throw new Error('OpenaiProvider.countTokens is not implemented')
  }
}
