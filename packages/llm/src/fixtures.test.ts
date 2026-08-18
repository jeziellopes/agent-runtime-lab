import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  FixtureInvalidError,
  FixtureNodeRequiredError,
  FixtureNotFoundError,
  RateLimitedError
} from '@arl/contracts'
import { afterEach, describe, expect, it } from 'vitest'

import {
  buildFailure,
  failureFor,
  forgetFixtureSets,
  loadFixture,
  loadFixtureSet,
  normalizeAttempt,
  parseFixture,
  selectCall
} from './fixtures.js'

import type { FixtureCall, ReplayFixture } from './fixtures.js'

/** The four on the benchmark path, with the token counts `specs/0008` pins. */
const BENCHMARK_PATH: { agentId: string; prompt: string; tokens: number[] }[] =
  [
    {
      agentId: 'simple-agent',
      prompt: 'Explain what an API gateway is.',
      tokens: [8]
    },
    { agentId: 'tool-agent', prompt: 'Calculate 125 * 50', tokens: [6, 6] },
    { agentId: 'tool-agent', prompt: 'What does API stand for?', tokens: [6] },
    {
      agentId: 'multi-step-agent',
      prompt: 'Compare REST and GraphQL for a public API.',
      tokens: [6, 7, 7]
    }
  ]

/**
 * Three of the four reserved prompts induce a provider failure. The fourth,
 * `Calculate 1 / bananas`, declares none: its tool is what rejects.
 */
const DECLARING_FAILURES = [
  '__fail_provider__',
  '__fail_rate_limit__',
  '__fail_midstream__'
]

const baseCall = {
  node: 'llm',
  tokens: ['one', ' two'],
  usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }
}

const wellFormed = {
  agentId: 'a',
  model: 'authored',
  prompt: 'p',
  calls: [baseCall]
}

function withCall(call: Record<string, unknown>): string {
  return JSON.stringify({ ...wellFormed, calls: [call] })
}

/** Writes a throwaway set so a malformed one can be loaded without shipping it. */
function temporarySet(files: Record<string, unknown>): {
  root: string
  set: string
} {
  const root = mkdtempSync(join(tmpdir(), 'arl-fixtures-'))
  const set = 'authored'

  mkdirSync(join(root, set))

  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(root, set, name), JSON.stringify(body), 'utf8')
  }

  return { root, set }
}

afterEach(() => {
  forgetFixtureSets()
})

describe('the committed contract set', () => {
  it('serves the simple agent one call of eight tokens', () => {
    const fixture = loadFixture(
      'contract',
      'simple-agent',
      'Explain what an API gateway is.'
    )

    expect(fixture.calls).toHaveLength(1)
    expect(fixture.calls[0]?.node).toBe('llm')
    expect(fixture.calls[0]?.tokens).toHaveLength(8)
  })

  it('parses all nine files', () => {
    expect(loadFixtureSet('contract').size).toBe(9)
  })

  it('matches the pinned token counts on the benchmark path', () => {
    for (const { agentId, prompt, tokens } of BENCHMARK_PATH) {
      const fixture = loadFixture('contract', agentId, prompt)

      expect(fixture.calls.map(call => call.tokens.length)).toEqual(tokens)
    }
  })

  it('states its provenance as authored throughout', () => {
    for (const fixture of loadFixtureSet('contract').values()) {
      expect(fixture.model).toBe('authored')
    }
  })

  it('declares failures only behind the reserved prompts', () => {
    const declaring = [...loadFixtureSet('contract').values()]
      .filter(fixture =>
        fixture.calls.some(call => call.failures !== undefined)
      )
      .map(fixture => fixture.prompt)
      .sort()

    expect(declaring).toEqual([...DECLARING_FAILURES].sort())
  })

  it('keeps the tool agent two prompts apart', () => {
    const withTool = loadFixture('contract', 'tool-agent', 'Calculate 125 * 50')
    const direct = loadFixture(
      'contract',
      'tool-agent',
      'What does API stand for?'
    )

    expect(withTool.calls).toHaveLength(2)
    expect(direct.calls).toHaveLength(1)
    expect(withTool.calls[0]?.tokens).not.toEqual(direct.calls[0]?.tokens)
  })
})

describe('selecting a fixture', () => {
  it('refuses an unknown pair rather than serving a neighbour', () => {
    expect(() => loadFixture('contract', 'simple-agent', 'unknown')).toThrow(
      FixtureNotFoundError
    )
  })

  it('refuses a request that names no agent or prompt', () => {
    expect(() => loadFixture('contract', undefined, 'p')).toThrow(
      FixtureNotFoundError
    )
    expect(() => loadFixture('contract', 'a', undefined)).toThrow(
      FixtureNotFoundError
    )
  })

  it('refuses a set that does not exist', () => {
    expect(() => loadFixtureSet('recorded')).toThrow(FixtureNotFoundError)
  })

  it('names both files when two claim the same pair', () => {
    const { root, set } = temporarySet({
      'one.json': wellFormed,
      'two.json': wellFormed
    })

    expect(() => loadFixtureSet(set, root)).toThrow(
      /one\.json and two\.json.*both claim agent a and prompt p/
    )
  })

  it('caches a parsed set rather than re-reading it', () => {
    expect(loadFixtureSet('contract')).toBe(loadFixtureSet('contract'))
  })
})

describe('schema validation', () => {
  const rejections: [string, string, RegExp][] = [
    ['malformed JSON', '{', /not valid JSON/],
    ['a JSON array', '[]', /must be a JSON object/],
    ['a JSON scalar', '3', /must be a JSON object/],
    [
      'an empty model',
      JSON.stringify({ ...wellFormed, model: '' }),
      /model must be a non-empty string/
    ],
    [
      'an absent agentId',
      JSON.stringify({ ...wellFormed, agentId: undefined }),
      /agentId must be a non-empty string/
    ],
    [
      'a non-string prompt',
      JSON.stringify({ ...wellFormed, prompt: 7 }),
      /prompt must be a non-empty string/
    ],
    [
      'no calls at all',
      JSON.stringify({ ...wellFormed, calls: [] }),
      /calls must be a non-empty array/
    ],
    [
      'a call that is not an object',
      JSON.stringify({ ...wellFormed, calls: ['llm'] }),
      /every entry of calls must be an object/
    ],
    [
      'a nameless node',
      withCall({ tokens: ['a'] }),
      /node must be a non-empty string/
    ],
    [
      'no tokens',
      withCall({ node: 'llm', tokens: [] }),
      /calls\[llm\]\.tokens must be a non-empty array/
    ],
    [
      'an empty token',
      withCall({ node: 'llm', tokens: [''] }),
      /calls\[llm\]\.tokens must hold only non-empty strings/
    ],
    [
      'no usage',
      withCall({ node: 'llm', tokens: ['a'] }),
      /calls\[llm\]\.usage must be an object/
    ],
    [
      'a fractional token count',
      withCall({
        node: 'llm',
        tokens: ['a'],
        usage: { inputTokens: 1.5, outputTokens: 1, totalTokens: 2 }
      }),
      /calls\[llm\]\.usage\.inputTokens must be an integer/
    ],
    [
      'failures that are not a list',
      withCall({ ...baseCall, failures: {} }),
      /calls\[llm\]\.failures must be an array/
    ],
    [
      'a failure that is not an object',
      withCall({ ...baseCall, failures: ['boom'] }),
      /failures\[0\] must be an object/
    ],
    [
      'a failure kind with no error behind it',
      withCall({
        ...baseCall,
        failures: [{ category: 'provider', kind: 'exploded' }]
      }),
      /kind is not a runtime error code: exploded/
    ],
    [
      'a category that contradicts its kind',
      withCall({
        ...baseCall,
        failures: [{ category: 'agent', kind: 'provider_error' }]
      }),
      /category must be provider for kind provider_error/
    ],
    [
      'a fractional retryAfterMs',
      withCall({
        ...baseCall,
        failures: [
          { category: 'provider', kind: 'rate_limited', retryAfterMs: 1.5 }
        ]
      }),
      /retryAfterMs must be an integer/
    ],
    [
      'a negative failAfterTokens',
      withCall({
        ...baseCall,
        failures: [
          { category: 'agent', kind: 'agent_error', failAfterTokens: -1 }
        ]
      }),
      /failAfterTokens must be a non-negative integer/
    ],
    [
      'a failAfterTokens past the end of the stream',
      withCall({
        ...baseCall,
        failures: [
          { category: 'agent', kind: 'agent_error', failAfterTokens: 3 }
        ]
      }),
      /failAfterTokens exceeds the call's 2 tokens/
    ],
    [
      'a fractional holdMs',
      withCall({ ...baseCall, holdMs: 1.5 }),
      /holdMs must be a positive integer/
    ],
    [
      'a holdMs of zero',
      withCall({ ...baseCall, holdMs: 0 }),
      /holdMs must be a positive integer/
    ],
    [
      'the same node twice',
      JSON.stringify({
        ...wellFormed,
        calls: [baseCall, baseCall]
      }),
      /calls declares node llm twice/
    ]
  ]

  it.each(rejections)('rejects %s', (_name, raw, message) => {
    expect(() => parseFixture('broken.json', raw)).toThrow(FixtureInvalidError)
    expect(() => parseFixture('broken.json', raw)).toThrow(message)
  })

  it('names the file on every rejection', () => {
    expect(() => parseFixture('broken.json', '{')).toThrow(/^broken\.json: /)
  })

  it('keeps a declared failAfterTokens equal to the token count', () => {
    const fixture = parseFixture(
      'ok.json',
      withCall({
        ...baseCall,
        failures: [
          { category: 'agent', kind: 'agent_error', failAfterTokens: 2 }
        ]
      })
    )

    expect(fixture.calls[0]?.failures?.[0]?.failAfterTokens).toBe(2)
  })

  it('carries a declared holdMs through, and omits the key otherwise', () => {
    expect(
      parseFixture('ok.json', withCall({ ...baseCall, holdMs: 250 })).calls[0]
        ?.holdMs
    ).toBe(250)
    expect(
      parseFixture('ok.json', withCall(baseCall)).calls[0]
    ).not.toHaveProperty('holdMs')
  })

  it('carries retryAfterMs through unchanged', () => {
    const fixture = parseFixture(
      'ok.json',
      withCall({
        ...baseCall,
        failures: [
          { category: 'provider', kind: 'rate_limited', retryAfterMs: 30000 }
        ]
      })
    )

    expect(fixture.calls[0]?.failures?.[0]?.retryAfterMs).toBe(30000)
  })
})

describe('choosing a call', () => {
  const twoCalls = loadFixture('contract', 'tool-agent', 'Calculate 125 * 50')
  const oneCall = loadFixture(
    'contract',
    'simple-agent',
    'Explain what an API gateway is.'
  )

  it('finds a call by node', () => {
    expect(selectCall(twoCalls, 'response').tokens[0]).toBe('125')
  })

  it('is unmoved by the order the calls appear in', () => {
    const reversed: ReplayFixture = {
      ...twoCalls,
      calls: [...twoCalls.calls].reverse()
    }

    expect(selectCall(reversed, 'planner').tokens).toEqual(
      selectCall(twoCalls, 'planner').tokens
    )
  })

  it('refuses a node the fixture does not declare', () => {
    expect(() => selectCall(twoCalls, 'analysis')).toThrow(FixtureNotFoundError)
  })

  it('serves a single-call fixture with no node named', () => {
    expect(selectCall(oneCall).tokens).toHaveLength(8)
  })

  it('demands a node when the fixture holds more than one call', () => {
    expect(() => selectCall(twoCalls)).toThrow(FixtureNodeRequiredError)
  })
})

describe('attempts and their failures', () => {
  const call: FixtureCall = {
    node: 'llm',
    tokens: ['a'],
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    failures: [
      { category: 'provider', kind: 'provider_error' },
      { category: 'provider', kind: 'rate_limited', retryAfterMs: 30000 }
    ]
  }

  it.each([
    ['omitted', undefined],
    ['zero', 0],
    ['negative', -3],
    ['fractional', 1.5]
  ])('reads a %s attempt as the first', (_name, attempt) => {
    expect(normalizeAttempt(attempt)).toBe(1)
  })

  it('keeps a real attempt', () => {
    expect(normalizeAttempt(3)).toBe(3)
  })

  it('raises entry N on attempt N and nothing once they run out', () => {
    expect(failureFor(call, 1)?.kind).toBe('provider_error')
    expect(failureFor(call, 2)?.kind).toBe('rate_limited')
    expect(failureFor(call, 3)).toBeUndefined()
  })

  it('reports no failure for a call that declares none', () => {
    expect(failureFor({ ...call, failures: undefined }, 1)).toBeUndefined()
  })

  it.each([
    ['agent_error', 'agent'],
    ['provider_error', 'provider'],
    ['rate_limited', 'provider'],
    ['tool_error', 'tool']
  ] as const)(
    'raises %s as %s category, never reclassified',
    (kind, category) => {
      const error = buildFailure({ category, kind })

      expect(error.category).toBe(category)
      expect(error.code).toBe(kind)
    }
  )

  it('carries retryAfterMs onto the rate limit error', () => {
    const error = buildFailure({
      category: 'provider',
      kind: 'rate_limited',
      retryAfterMs: 30000
    })

    expect(error).toBeInstanceOf(RateLimitedError)
    expect((error as RateLimitedError).retryAfter).toBe(30000)
  })
})
