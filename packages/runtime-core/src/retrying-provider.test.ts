import { AgentError, ProviderError } from '@arl/contracts'
import { describe, expect, it, vi } from 'vitest'

import { createRetryPolicy } from './retry-policy.js'
import { retrying } from './retrying-provider.js'

import type { LLMChunk, LLMProvider, LLMRequest } from '@arl/contracts'

const USAGE = { inputTokens: 1, outputTokens: 1, totalTokens: 2 }

/** Fails the first `failures` attempts, then answers. */
function flaky(
  failures: number,
  error: () => Error = () => new ProviderError('down')
) {
  const attempts: (number | undefined)[] = []

  const provider: LLMProvider = {
    generate: request => {
      attempts.push(request.attempt)

      if (attempts.length <= failures) {
        return Promise.reject(error())
      }

      return Promise.resolve({ content: 'ok', usage: USAGE })
    },

    stream: request => {
      attempts.push(request.attempt)

      if (attempts.length <= failures) {
        throw error()
      }

      return (async function* one(): AsyncIterable<LLMChunk> {
        yield { token: 'ok', done: true }
      })()
    },

    countTokens: () => Promise.resolve(2)
  }

  return { provider, attempts }
}

function wrap(provider: LLMProvider, maxRetries = 3) {
  const sleep = vi.fn(() => Promise.resolve())

  return {
    wrapped: retrying(provider, createRetryPolicy(maxRetries), sleep),
    sleep
  }
}

const request: LLMRequest = { messages: [], model: 'authored' }

async function tokensOf(stream: AsyncIterable<LLMChunk>): Promise<string[]> {
  const tokens: string[] = []

  for await (const chunk of stream) {
    tokens.push(chunk.token)
  }

  return tokens
}

describe('retrying a provider failure', () => {
  it('answers on the attempt after the declared failures run out', async () => {
    const { provider, attempts } = flaky(2)
    const { wrapped } = wrap(provider)

    await expect(wrapped.generate(request)).resolves.toMatchObject({
      content: 'ok'
    })
    expect(attempts).toEqual([1, 2, 3])
  })

  it('does the same for a stream', async () => {
    const { provider, attempts } = flaky(2)
    const { wrapped } = wrap(provider)

    await expect(tokensOf(wrapped.stream(request))).resolves.toEqual(['ok'])
    expect(attempts).toEqual([1, 2, 3])
  })

  it('raises once the retry budget is spent', async () => {
    const { provider, attempts } = flaky(9)
    const { wrapped } = wrap(provider, 3)

    await expect(wrapped.generate(request)).rejects.toBeInstanceOf(
      ProviderError
    )
    expect(attempts).toEqual([1, 2, 3, 4])
  })

  it('waits the policy backoff between attempts', async () => {
    const { provider } = flaky(2)
    const { wrapped, sleep } = wrap(provider)

    await wrapped.generate(request)

    expect(sleep.mock.calls).toEqual([[100], [200]])
  })
})

describe('what is not retried', () => {
  it.each([
    ['an agent failure', () => new AgentError('bad node')],
    ['a plain Error', () => new Error('boom')]
  ])('invokes the provider once for %s', async (_case, error) => {
    const { provider, attempts } = flaky(9, error)
    const { wrapped } = wrap(provider)

    await expect(wrapped.generate(request)).rejects.toThrow()
    expect(attempts).toEqual([1])
  })

  it('invokes the provider once for a stream that fails outside its category', async () => {
    const { provider, attempts } = flaky(9, () => new AgentError('bad node'))
    const { wrapped } = wrap(provider)

    await expect(tokensOf(wrapped.stream(request))).rejects.toThrow()
    expect(attempts).toEqual([1])
  })

  it('leaves a mid-iteration failure alone, having already yielded', async () => {
    const provider: LLMProvider = {
      generate: () => Promise.reject(new ProviderError('down')),
      stream: () =>
        (async function* half(): AsyncIterable<LLMChunk> {
          yield { token: 'one', done: false }
          throw new ProviderError('died mid-stream')
        })(),
      countTokens: () => Promise.resolve(0)
    }
    const { wrapped } = wrap(provider)

    await expect(tokensOf(wrapped.stream(request))).rejects.toBeInstanceOf(
      ProviderError
    )
  })
})

describe('what passes straight through', () => {
  it('forwards countTokens untouched', async () => {
    const { provider } = flaky(0)
    const { wrapped } = wrap(provider)

    await expect(wrapped.countTokens([])).resolves.toBe(2)
  })
})
