import { describe, expect, it } from 'vitest'

import { RUNTIME_EVENT_TYPES } from './event-type.js'

import type { RuntimeEvent } from './runtime-event.js'

const EPOCH = new Date(0)

/**
 * Exhaustive over the union. Removing a member from `RuntimeEvent`, or adding a
 * thirteenth event without a case here, stops this compiling.
 */
function describeEvent(event: RuntimeEvent): string {
  switch (event.type) {
    case 'execution.created':
      return event.data.agentId
    case 'execution.started':
      return 'started'
    case 'node.started':
      return event.data.node
    case 'node.completed':
      return event.data.branch ?? event.data.node
    case 'llm.started':
      return event.data.model
    case 'llm.token':
      return event.data.token
    case 'llm.completed':
      return String(event.data.usage.totalTokens)
    case 'tool.started':
      return event.data.tool
    case 'tool.completed':
      return event.data.tool
    case 'execution.completed':
      return JSON.stringify(event.data.output)
    case 'execution.failed':
      return event.data.error
    case 'execution.cancelled':
      return 'cancelled'
  }
}

const SAMPLES: RuntimeEvent[] = [
  {
    type: 'execution.created',
    executionId: 'exec-1',
    timestamp: EPOCH,
    data: { agentId: 'simple-agent' }
  },
  { type: 'execution.started', executionId: 'exec-1', timestamp: EPOCH },
  {
    type: 'node.started',
    executionId: 'exec-1',
    timestamp: EPOCH,
    data: { node: 'llm' }
  },
  {
    type: 'node.completed',
    executionId: 'exec-1',
    timestamp: EPOCH,
    data: { node: 'llm' }
  },
  {
    type: 'llm.started',
    executionId: 'exec-1',
    timestamp: EPOCH,
    data: { node: 'llm', model: 'authored' }
  },
  {
    type: 'llm.token',
    executionId: 'exec-1',
    timestamp: EPOCH,
    data: { token: ' API' }
  },
  {
    type: 'llm.completed',
    executionId: 'exec-1',
    timestamp: EPOCH,
    data: {
      node: 'llm',
      usage: { inputTokens: 6, outputTokens: 8, totalTokens: 14 }
    }
  },
  {
    type: 'tool.started',
    executionId: 'exec-1',
    timestamp: EPOCH,
    data: { tool: 'calculator', input: { expression: '125 * 50' } }
  },
  {
    type: 'tool.completed',
    executionId: 'exec-1',
    timestamp: EPOCH,
    data: { tool: 'calculator', output: 6250 }
  },
  {
    type: 'execution.completed',
    executionId: 'exec-1',
    timestamp: EPOCH,
    data: { output: { text: 'done' } }
  },
  {
    type: 'execution.failed',
    executionId: 'exec-1',
    timestamp: EPOCH,
    data: { error: 'provider_error', detail: 'upstream timed out' }
  },
  { type: 'execution.cancelled', executionId: 'exec-1', timestamp: EPOCH }
]

describe('the runtime event union', () => {
  it('has one member per declared event type', () => {
    expect(SAMPLES.map(event => event.type).sort()).toEqual(
      [...RUNTIME_EVENT_TYPES].sort()
    )
  })

  it('narrows on type, so every member reaches its own payload', () => {
    expect(SAMPLES.map(describeEvent)).toEqual([
      'simple-agent',
      'started',
      'llm',
      'llm',
      'authored',
      ' API',
      '14',
      'calculator',
      'calculator',
      '{"text":"done"}',
      'provider_error',
      'cancelled'
    ])
  })

  it('carries no data key on the two events that have nothing to say', () => {
    for (const type of ['execution.started', 'execution.cancelled']) {
      const event = SAMPLES.find(sample => sample.type === type)

      expect(JSON.stringify(event)).not.toContain('"data"')
    }
  })

  it('serialises the top level in the order the contract fixes', () => {
    for (const event of SAMPLES) {
      const keys = Object.keys(JSON.parse(JSON.stringify(event)) as object)

      expect(keys.slice(0, 3)).toEqual(['type', 'executionId', 'timestamp'])
    }
  })

  it('prefers the branch label when a conditional edge was taken', () => {
    expect(
      describeEvent({
        type: 'node.completed',
        executionId: 'exec-1',
        timestamp: EPOCH,
        data: { node: 'decision', branch: 'needs-tool' }
      })
    ).toBe('needs-tool')
  })

  it('refuses a payload that belongs to a different event', () => {
    const token: RuntimeEvent = {
      type: 'llm.token',
      executionId: 'exec-1',
      timestamp: EPOCH,
      data: { token: ' API' }
    }

    if (token.type === 'llm.token') {
      // @ts-expect-error `node` belongs to node.started, not llm.token
      expect(token.data.node).toBeUndefined()
    }
  })
})
