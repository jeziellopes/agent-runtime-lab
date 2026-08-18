import type { RetryPolicy } from './retry-policy.js'
import type {
  LLMChunk,
  LLMProvider,
  LLMRequest,
  LLMResponse
} from '@arl/contracts'

/**
 * The runtime owns provider retry, but the node is what calls the provider. So
 * L2 hands the node a provider that already retries, and the node emits one
 * `llm.started` / `llm.completed` pair however many attempts it took.
 *
 * That is what makes retry transparent in the event stream: there is no
 * thirteenth event, for the same reason `WAITING` has none.
 */
export function retrying(
  provider: LLMProvider,
  policy: RetryPolicy,
  sleep: (ms: number) => Promise<void>
): LLMProvider {
  return {
    generate: request => attemptAsync(request, next => provider.generate(next)),

    /**
     * A failure the provider raises before the first token is retried here. One
     * that lands mid-iteration is not: the tokens it already yielded are on the
     * wire, so replaying them would put a second copy in the stream.
     */
    stream: request => attemptSync(request, next => provider.stream(next)),

    countTokens: messages => provider.countTokens(messages)
  }

  async function attemptAsync(
    request: LLMRequest,
    call: (request: LLMRequest) => Promise<LLMResponse>
  ): Promise<LLMResponse> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await call({ ...request, attempt })
      } catch (failure) {
        await waitOrThrow(failure, attempt)
      }
    }
  }

  function attemptSync(
    request: LLMRequest,
    call: (request: LLMRequest) => AsyncIterable<LLMChunk>
  ): AsyncIterable<LLMChunk> {
    return {
      async *[Symbol.asyncIterator]() {
        for (let attempt = 1; ; attempt += 1) {
          let opened: AsyncIterable<LLMChunk>

          try {
            opened = call({ ...request, attempt })
          } catch (failure) {
            await waitOrThrow(failure, attempt)
            continue
          }

          yield* opened

          return
        }
      }
    }
  }

  async function waitOrThrow(failure: unknown, attempt: number): Promise<void> {
    if (attempt > policy.maxRetries || !policy.shouldRetry(failure)) {
      throw failure
    }

    await sleep(policy.backoffMs(attempt))
  }
}
