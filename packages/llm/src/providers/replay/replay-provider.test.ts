import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  AgentError,
  FixtureNodeRequiredError,
  FixtureNotFoundError,
  ProviderError,
  RateLimitedError
} from '@arl/contracts'
import { describe, expect, it } from 'vitest'

import { ReplayLLMProvider } from './replay-provider.js'

import type { LLMChunk, LLMRequest } from '@arl/contracts'

const provider = new ReplayLLMProvider('contract')

const simple = {
  agentId: 'simple-agent',
  prompt: 'Explain what an API gateway is.'
}
const multiStep = {
  agentId: 'multi-step-agent',
  prompt: 'Compare REST and GraphQL for a public API.'
}

function request(overrides: Partial<LLMRequest>): LLMRequest {
  return { messages: [], model: 'ignored', ...overrides }
}

async function tokensOf(overrides: Partial<LLMRequest>): Promise<string[]> {
  const tokens: string[] = []

  for await (const chunk of provider.stream(request(overrides))) {
    tokens.push(chunk.token)
  }

  return tokens
}

describe('selecting what to replay', () => {
  it('looks a call up by node rather than by position', async () => {
    await expect(
      tokensOf({ ...multiStep, nodeId: 'planner' })
    ).resolves.toHaveLength(6)
    await expect(
      tokensOf({ ...multiStep, nodeId: 'research' })
    ).resolves.toHaveLength(7)
  })

  it('serves a single-call fixture with no node named', async () => {
    await expect(tokensOf(simple)).resolves.toHaveLength(8)
  })

  it('demands a node when the fixture holds more than one call', () => {
    expect(() => provider.stream(request(multiStep))).toThrow(
      FixtureNodeRequiredError
    )
  })

  it('refuses a node the fixture does not declare', () => {
    expect(() =>
      provider.stream(request({ ...simple, nodeId: 'planner' }))
    ).toThrow(FixtureNotFoundError)
  })

  it('refuses a request carrying no fixture key', async () => {
    expect(() => provider.stream(request({ nodeId: 'llm' }))).toThrow(
      FixtureNotFoundError
    )

    await expect(
      provider.generate(request({ nodeId: 'llm' }))
    ).rejects.toBeInstanceOf(FixtureNotFoundError)
  })

  it('replays the same request identically every time', async () => {
    expect(await tokensOf(simple)).toEqual(await tokensOf(simple))
  })

  it('keeps two concurrent streams apart, holding no shared cursor', async () => {
    const other = new ReplayLLMProvider('contract')
    const [planner, analysis] = await Promise.all([
      tokensOf({ ...multiStep, nodeId: 'planner' }),
      (async () => {
        const tokens: string[] = []

        for await (const chunk of other.stream(
          request({ ...multiStep, nodeId: 'analysis' })
        )) {
          tokens.push(chunk.token)
        }

        return tokens
      })()
    ])

    expect(planner?.[0]).toBe('First')
    expect(analysis?.[0]).toBe('GraphQL')
  })
})

describe('generate', () => {
  it('returns the call tokens joined, with the call usage', async () => {
    const response = await provider.generate(request(simple))

    expect(response.content).toBe(
      'An API gateway routes requests to backend services.'
    )
    expect(response.usage).toEqual({
      inputTokens: 6,
      outputTokens: 8,
      totalTokens: 14
    })
  })

  it('rejects when the signal is already aborted', async () => {
    await expect(
      provider.generate(request({ ...simple, signal: AbortSignal.abort() }))
    ).rejects.toThrow()
  })

  it('raises a declared failure rather than answering', async () => {
    await expect(
      provider.generate(
        request({ agentId: 'simple-agent', prompt: '__fail_provider__' })
      )
    ).rejects.toBeInstanceOf(ProviderError)
  })
})

describe('declared failures', () => {
  const failing = { agentId: 'simple-agent', prompt: '__fail_provider__' }

  it('raises one per attempt until the sequence runs out', () => {
    for (const attempt of [1, 2, 3, 4]) {
      expect(() => provider.stream(request({ ...failing, attempt }))).toThrow(
        ProviderError
      )
    }
  })

  it('streams normally once the declared failures are exhausted', async () => {
    await expect(tokensOf({ ...failing, attempt: 5 })).resolves.toHaveLength(8)
  })

  it.each([undefined, 0, -2, 1.5])('reads attempt %s as the first', attempt => {
    expect(() => provider.stream(request({ ...failing, attempt }))).toThrow(
      ProviderError
    )
  })

  it('carries retryAfterMs onto a rate limit', () => {
    try {
      provider.stream(
        request({ agentId: 'simple-agent', prompt: '__fail_rate_limit__' })
      )
      expect.unreachable('the fixture declares a failure on the first attempt')
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitedError)
      expect((error as RateLimitedError).retryAfter).toBe(30000)
    }
  })

  it('raises an agent-category failure mid-stream, unreclassified', async () => {
    const seen: string[] = []
    const stream = provider.stream(
      request({ agentId: 'simple-agent', prompt: '__fail_midstream__' })
    )

    await expect(
      (async () => {
        for await (const chunk of stream) {
          seen.push(chunk.token)
        }
      })()
    ).rejects.toBeInstanceOf(AgentError)

    expect(seen).toHaveLength(3)
  })
})

describe('counting tokens', () => {
  it('counts whitespace-separated runs', async () => {
    await expect(
      provider.countTokens([
        { role: 'user', content: 'one two three four five' }
      ])
    ).resolves.toBe(5)
  })

  it('ignores padding and empty content', async () => {
    await expect(
      provider.countTokens([{ role: 'user', content: '  one \n\t two  ' }])
    ).resolves.toBe(2)
    await expect(
      provider.countTokens([{ role: 'user', content: '' }])
    ).resolves.toBe(0)
  })

  it('sums across messages and repeats itself', async () => {
    const messages = [
      { role: 'system' as const, content: 'a b' },
      { role: 'user' as const, content: 'c d e' }
    ]

    await expect(provider.countTokens(messages)).resolves.toBe(5)
    await expect(provider.countTokens(messages)).resolves.toBe(5)
  })
})

describe('the shape of the provider itself', () => {
  it('takes a fixture set and nothing else', () => {
    expect(ReplayLLMProvider.length).toBe(1)
    expect(provider.fixtures).toBe('contract')
  })

  it('exposes no inter-token delay', () => {
    expect('delayMs' in provider).toBe(false)
  })

  it('declares no framework dependency and no HTTP client', () => {
    const manifest = readFileSync(
      join(__dirname, '..', '..', '..', 'package.json'),
      'utf8'
    ) as string
    const { dependencies } = JSON.parse(manifest) as {
      dependencies: Record<string, string>
    }

    expect(Object.keys(dependencies)).toEqual(['@arl/contracts'])
  })

  it('imports nothing that could reach a network', () => {
    for (const file of ['replay-provider.ts', 'replay-stream.ts']) {
      const source = readFileSync(join(__dirname, file), 'utf8')

      expect(source).not.toMatch(/from '(node:http|node:https|undici|axios)/)
      expect(source).not.toMatch(/\bfetch\(/)
    }
  })
})

describe('chunk shape', () => {
  it('marks only the final chunk done, and never yields an empty token', async () => {
    const chunks: LLMChunk[] = []

    for await (const chunk of provider.stream(request(simple))) {
      chunks.push(chunk)
    }

    expect(chunks.filter(chunk => chunk.done)).toHaveLength(1)
    expect(chunks[chunks.length - 1]?.done).toBe(true)
    expect(chunks.every(chunk => chunk.token.length > 0)).toBe(true)
  })
})
