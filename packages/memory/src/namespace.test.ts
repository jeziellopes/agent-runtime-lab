import { AgentError } from '@arl/contracts'
import { describe, expect, it } from 'vitest'

import { namespaceFor } from './namespace.js'

import type { ExecutionContext } from '@arl/contracts'

function context(overrides: Partial<ExecutionContext>): ExecutionContext {
  return {
    executionId: 'e1',
    agentId: 'simple-agent',
    state: {},
    metadata: {},
    ...overrides
  }
}

describe('deriving a namespace', () => {
  it('scopes to the session when there is one', () => {
    expect(namespaceFor(context({ sessionId: 's1' }))).toBe('session:s1')
  })

  it('scopes to the execution when there is not', () => {
    expect(namespaceFor(context({}))).toBe('execution:e1')
  })

  it.each([
    ['an empty sessionId', ''],
    ['an absent sessionId', undefined]
  ])('falls back to the execution for %s', (_case, sessionId) => {
    expect(namespaceFor(context({ sessionId }))).toBe('execution:e1')
  })
})

describe('keeping the two scopes apart', () => {
  it('does not let a sessionId collide with another execution id', () => {
    expect(namespaceFor(context({ sessionId: 'x' }))).not.toBe(
      namespaceFor(context({ executionId: 'x' }))
    )
  })

  it('isolates two executions of the same agent', () => {
    expect(namespaceFor(context({ executionId: 'e1' }))).not.toBe(
      namespaceFor(context({ executionId: 'e2' }))
    )
  })
})

describe('a context that names nothing', () => {
  it.each([
    ['an empty executionId', ''],
    ['an absent executionId', undefined],
    ['a non-string executionId', 42]
  ])('refuses %s', (_case, executionId) => {
    expect(() =>
      namespaceFor(context({ executionId: executionId as string }))
    ).toThrow(AgentError)
  })

  it('raises an agent-category error', () => {
    try {
      namespaceFor(context({ executionId: '' }))
      expect.unreachable('the context names no execution')
    } catch (error) {
      expect(error).toMatchObject({ category: 'agent', code: 'agent_error' })
    }
  })
})
