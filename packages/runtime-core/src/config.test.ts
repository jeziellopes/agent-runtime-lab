import { describe, expect, it } from 'vitest'

import { loadRuntimeConfig } from './config.js'

describe('loading the runtime config', () => {
  it('returns every default from an empty environment', () => {
    expect(loadRuntimeConfig({})).toEqual({
      defaultModel: 'authored',
      maxIterations: 10,
      timeoutMs: 30_000,
      llmMode: 'replay',
      maxRetries: 3,
      deterministic: false,
      fixtureSet: 'contract'
    })
  })

  it('reads what the environment does set', () => {
    expect(
      loadRuntimeConfig({
        MODEL_NAME: 'claude-sonnet-5',
        MAX_ITERATIONS: '4',
        TIMEOUT_MS: '900',
        LLM_MODE: 'live',
        MAX_RETRIES: '1',
        DETERMINISTIC: 'true',
        FIXTURE_SET: 'benchmark'
      })
    ).toEqual({
      defaultModel: 'claude-sonnet-5',
      maxIterations: 4,
      timeoutMs: 900,
      llmMode: 'live',
      maxRetries: 1,
      deterministic: true,
      fixtureSet: 'benchmark'
    })
  })

  /* A cell that refused to start on a malformed env var would drop out of the
     matrix, and an absent cell is worse than a defaulted one. */
  it.each([
    ['MAX_ITERATIONS', 'maxIterations', 10],
    ['TIMEOUT_MS', 'timeoutMs', 30_000],
    ['MAX_RETRIES', 'maxRetries', 3]
  ])(
    'defaults rather than throws for a non-integer %s',
    (key, field, value) => {
      expect(loadRuntimeConfig({ [key]: 'lots' })).toMatchObject({
        [field]: value
      })
    }
  )

  it('defaults an unrecognised LLM_MODE to replay', () => {
    expect(loadRuntimeConfig({ LLM_MODE: 'anthropic' }).llmMode).toBe('replay')
  })

  it('treats anything but the literal true as not deterministic', () => {
    expect(loadRuntimeConfig({ DETERMINISTIC: '1' }).deterministic).toBe(false)
  })
})
