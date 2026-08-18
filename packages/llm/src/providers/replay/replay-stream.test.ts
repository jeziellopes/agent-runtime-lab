import { AgentError, ProviderError } from '@arl/contracts'
import { describe, expect, it } from 'vitest'

import { replayTokens } from './replay-stream.js'

import type { FixtureCall } from '../../fixtures.js'
import type { LLMChunk } from '@arl/contracts'

const call: FixtureCall = {
  node: 'llm',
  tokens: ['one', ' two', ' three'],
  usage: { inputTokens: 1, outputTokens: 3, totalTokens: 4 }
}

async function collect(stream: AsyncIterable<LLMChunk>): Promise<LLMChunk[]> {
  const chunks: LLMChunk[] = []

  for await (const chunk of stream) {
    chunks.push(chunk)
  }

  return chunks
}

describe('replaying a call', () => {
  it('yields one chunk per token and marks only the last done', async () => {
    const chunks = await collect(replayTokens(call, undefined))

    expect(chunks.map(chunk => chunk.token)).toEqual(call.tokens)
    expect(chunks.map(chunk => chunk.done)).toEqual([false, false, true])
  })

  it('never yields an empty token', async () => {
    const chunks = await collect(replayTokens(call, undefined))

    expect(chunks.every(chunk => chunk.token.length > 0)).toBe(true)
  })

  it('is byte-identical across repeated replays', async () => {
    const first = await collect(replayTokens(call, undefined))
    const second = await collect(replayTokens(call, undefined))

    expect(first).toEqual(second)
  })
})

describe('a failure that lands mid-stream', () => {
  it('yields the declared tokens, then raises', async () => {
    const stream = replayTokens(call, {
      category: 'agent',
      kind: 'agent_error',
      failAfterTokens: 2
    })
    const seen: string[] = []

    await expect(
      (async () => {
        for await (const chunk of stream) {
          seen.push(chunk.token)
        }
      })()
    ).rejects.toBeInstanceOf(AgentError)

    expect(seen).toEqual(['one', ' two'])
  })

  it('raises after the whole stream when the count matches it', async () => {
    const stream = replayTokens(call, {
      category: 'provider',
      kind: 'provider_error',
      failAfterTokens: call.tokens.length
    })
    const seen: string[] = []

    await expect(
      (async () => {
        for await (const chunk of stream) {
          seen.push(chunk.token)
        }
      })()
    ).rejects.toBeInstanceOf(ProviderError)

    expect(seen).toEqual(call.tokens)
  })

  it('raises before the first token when the count is zero', async () => {
    await expect(
      collect(
        replayTokens(call, {
          category: 'agent',
          kind: 'agent_error',
          failAfterTokens: 0
        })
      )
    ).rejects.toBeInstanceOf(AgentError)
  })
})

describe('cancellation', () => {
  it('yields nothing when the signal is already aborted', async () => {
    expect(
      await collect(replayTokens(call, undefined, AbortSignal.abort()))
    ).toEqual([])
  })

  it('stops after the yield in flight, and returns rather than throwing', async () => {
    const controller = new AbortController()
    const seen: string[] = []

    for await (const chunk of replayTokens(
      call,
      undefined,
      controller.signal
    )) {
      seen.push(chunk.token)
      controller.abort()
    }

    expect(seen).toEqual(['one'])
  })
})
