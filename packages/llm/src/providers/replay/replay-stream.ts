import { buildFailure } from '../../fixtures.js'

import type { FixtureCall, FixtureFailure } from '../../fixtures.js'
import type { LLMChunk } from '@arl/contracts'

/**
 * Exactly one chunk per token, in order, with no trailing empty chunk. The
 * runtime emits one `llm.token` per chunk, so an extra chunk is an extra frame
 * in the goldens.
 *
 * `failAfterTokens` yields that many tokens and then raises, which is the only
 * way a failure lands after the SSE headers are sent. A value equal to the
 * token count raises once the whole stream has been delivered.
 *
 * `holdMs` waits before each token. It is what keeps one execution running long
 * enough for a client to cancel it, and the abort check below is what makes
 * that cancellation land between two tokens rather than after the last.
 */
export async function* replayTokens(
  call: FixtureCall,
  failure: FixtureFailure | undefined,
  signal?: AbortSignal
): AsyncIterable<LLMChunk> {
  const raiseAfter = failure?.failAfterTokens
  const last = call.tokens.length - 1

  for (const [index, token] of call.tokens.entries()) {
    await hold(call.holdMs, signal)

    if (signal?.aborted === true) {
      return
    }

    if (failure !== undefined && index === raiseAfter) {
      throw buildFailure(failure)
    }

    yield { token, done: index === last }
  }

  if (failure !== undefined && raiseAfter === call.tokens.length) {
    throw buildFailure(failure)
  }
}

/** Resolves early on abort, so a cancelled stream is not held to its budget. */
function hold(ms: number | undefined, signal?: AbortSignal): Promise<void> {
  if (ms === undefined) {
    return Promise.resolve()
  }

  return new Promise(resolve => {
    const done = (): void => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }

    const timer = setTimeout(done, ms)

    signal?.addEventListener('abort', done)
  })
}
