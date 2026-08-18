import {
  AgentError,
  ProviderError,
  RateLimitedError,
  ToolError
} from '@arl/contracts'
import { describe, expect, it } from 'vitest'

import { createRetryPolicy } from './retry-policy.js'

const policy = createRetryPolicy(3)

describe('backoff', () => {
  it.each([
    [1, 100],
    [2, 200],
    [3, 400],
    [4, 800],
    [5, 1600]
  ])('waits %sms before attempt %s', (attempt, expected) => {
    expect(policy.backoffMs(attempt)).toBe(expected)
  })

  it('never exceeds the ceiling, however many attempts have passed', () => {
    for (const attempt of [6, 7, 20, 100]) {
      expect(policy.backoffMs(attempt)).toBe(2000)
    }
  })
})

describe('what gets retried', () => {
  it.each([
    ['a provider failure', new ProviderError('down'), true],
    ['a rate limit', new RateLimitedError('slow down', 30_000), true],
    ['an agent failure', new AgentError('bad graph'), false],
    ['a tool failure', new ToolError('bad input'), false],
    ['a plain Error', new Error('boom'), false],
    ['a thrown string', 'boom', false]
  ])('retries %s: %s', (_case, error, expected) => {
    expect(policy.shouldRetry(error)).toBe(expected)
  })

  it('carries the retry budget it was built with', () => {
    expect(policy.maxRetries).toBe(3)
  })
})
