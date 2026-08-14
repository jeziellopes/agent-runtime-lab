import { describe, expect, it } from 'vitest'

import {
  AgentAlreadyRegisteredError,
  AgentError,
  AgentNotFoundError,
  ExecutionNotFoundError,
  FixtureInvalidError,
  FixtureNodeRequiredError,
  FixtureNotFoundError,
  GraphInvalidError,
  GraphRouteInvalidError,
  MaxIterationsExceededError,
  ProviderError,
  RateLimitedError,
  RuntimeError,
  ToolError,
  ValidationError
} from './errors.js'

import type { ErrorCategory, RuntimeErrorCode } from './errors.js'

const ERRORS = [
  AgentError,
  AgentNotFoundError,
  AgentAlreadyRegisteredError,
  ExecutionNotFoundError,
  GraphInvalidError,
  GraphRouteInvalidError,
  MaxIterationsExceededError,
  FixtureNotFoundError,
  FixtureInvalidError,
  FixtureNodeRequiredError,
  ProviderError,
  RateLimitedError,
  ToolError,
  ValidationError
] as const

const CODES: readonly RuntimeErrorCode[] = [
  'agent_error',
  'agent_not_found',
  'agent_already_registered',
  'execution_not_found',
  'graph_invalid',
  'graph_route_invalid',
  'max_iterations_exceeded',
  'fixture_not_found',
  'fixture_invalid',
  'fixture_node_required',
  'provider_error',
  'rate_limited',
  'tool_error',
  'invalid_request'
]

const CATEGORIES: readonly ErrorCategory[] = [
  'agent',
  'provider',
  'tool',
  'validation'
]

describe('runtime error identities', () => {
  it('gives every code exactly one class', () => {
    const codes = ERRORS.map(Error_ => new Error_('detail').code)

    expect(new Set(codes).size).toBe(ERRORS.length)
    expect([...codes].sort()).toEqual([...CODES].sort())
  })

  it('categorises every error into one of the four categories', () => {
    for (const Error_ of ERRORS) {
      expect(CATEGORIES).toContain(new Error_('detail').category)
    }
  })

  it('keys status by code, not by category', () => {
    const notFound = new AgentNotFoundError('no such agent')
    const failed = new AgentError('the graph blew up')

    expect(notFound.category).toBe(failed.category)
    expect(notFound.code).not.toBe(failed.code)
  })

  it('carries the detail as the message, and names itself after its class', () => {
    const error = new ToolError('expression rejected')

    expect(error.detail).toBe('expression rejected')
    expect(error.message).toBe('expression rejected')
    expect(error.name).toBe('ToolError')
  })

  it('is catchable as RuntimeError and as Error', () => {
    for (const Error_ of ERRORS) {
      const error = new Error_('detail')

      expect(error).toBeInstanceOf(RuntimeError)
      expect(error).toBeInstanceOf(Error)
    }
  })

  it('carries retryAfter only when rate limiting supplies one', () => {
    expect(new RateLimitedError('slow down').retryAfter).toBeUndefined()
    expect(new RateLimitedError('slow down', 30).retryAfter).toBe(30)
  })
})
