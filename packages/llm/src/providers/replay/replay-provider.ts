import {
  buildFailure,
  failureFor,
  loadFixture,
  normalizeAttempt,
  selectCall
} from '../../fixtures.js'
import { replayTokens } from './replay-stream.js'

import type { FixtureCall } from '../../fixtures.js'
import type {
  LLMChunk,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  Message
} from '@arl/contracts'

/**
 * FAKE: stands in for a live LLM provider, and it is the DEFAULT rather than
 * the fallback. Nothing in the measured path reaches a network.
 *
 * It holds a fixture set name and nothing else. Every lookup is a pure function
 * of the request and the file, so one instance serves any number of concurrent
 * executions without a cursor, a lock or an eviction rule.
 *
 * Real agent workflows, real tool execution and real streaming transport are
 * still used throughout. Only the model call is replayed.
 */
export class ReplayLLMProvider implements LLMProvider {
  constructor(private readonly fixtureSet: string) {}

  async generate(request: LLMRequest): Promise<LLMResponse> {
    request.signal?.throwIfAborted()

    const call = this.resolve(request)
    const failure = failureFor(call, normalizeAttempt(request.attempt))

    if (failure !== undefined) {
      throw buildFailure(failure)
    }

    return { content: call.tokens.join(''), usage: call.usage }
  }

  /**
   * A failure without `failAfterTokens` is raised here rather than from the
   * iterator, and that is the point of the split: the adapter has not written
   * the SSE headers yet, so the failure can still become a status. Only
   * `failAfterTokens` lands mid-stream, where it has to become an event.
   */
  stream(request: LLMRequest): AsyncIterable<LLMChunk> {
    const call = this.resolve(request)
    const declared = failureFor(call, normalizeAttempt(request.attempt))

    if (declared !== undefined && declared.failAfterTokens === undefined) {
      throw buildFailure(declared)
    }

    return replayTokens(call, declared, request.signal)
  }

  /**
   * Whitespace-separated non-empty runs. A word count rather than a tokenizer:
   * it has to be deterministic and identical in all four cells, and under
   * replay the input count is synthetic regardless.
   */
  countTokens(messages: Message[]): Promise<number> {
    return Promise.resolve(
      messages.reduce(
        (total, message) =>
          total +
          message.content.split(/\s+/).filter(word => word.length > 0).length,
        0
      )
    )
  }

  get fixtures(): string {
    return this.fixtureSet
  }

  private resolve(request: LLMRequest): FixtureCall {
    const fixture = loadFixture(
      this.fixtureSet,
      request.agentId,
      request.prompt
    )

    return selectCall(fixture, request.nodeId)
  }
}
