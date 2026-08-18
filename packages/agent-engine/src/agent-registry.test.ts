import { AgentAlreadyRegisteredError, AgentError } from '@arl/contracts'
import { describe, expect, it } from 'vitest'

import { InMemoryAgentRegistry } from './agent-registry.js'

import type { AgentDefinition } from '@arl/contracts'

function definition(id: string): AgentDefinition {
  return {
    id,
    name: id,
    description: `the ${id} agent`,
    graph: { entry: 'a', nodes: [], edges: [] },
    tools: []
  }
}

describe('holding definitions', () => {
  it('returns what was registered', () => {
    const registry = new InMemoryAgentRegistry()
    const simple = definition('simple-agent')

    registry.register(simple)

    expect(registry.get('simple-agent')).toBe(simple)
  })

  it('returns null for an id nobody registered', () => {
    expect(new InMemoryAgentRegistry().get('simple-agent')).toBeNull()
  })

  it('lets the first registration stand and refuses the second', () => {
    const registry = new InMemoryAgentRegistry()
    const first = definition('simple-agent')

    registry.register(first)

    expect(() => registry.register(definition('simple-agent'))).toThrow(
      AgentAlreadyRegisteredError
    )
    expect(registry.get('simple-agent')).toBe(first)
  })

  it.each([
    ['an empty id', ''],
    ['an id that is not a string', 42]
  ])('refuses %s', (_case, id) => {
    expect(() =>
      new InMemoryAgentRegistry().register({
        ...definition('x'),
        id
      } as AgentDefinition)
    ).toThrow(AgentError)
  })
})

describe('listing', () => {
  it('sorts by id, whatever order they arrived in', () => {
    const registry = new InMemoryAgentRegistry()

    for (const id of ['tool-agent', 'multi-step-agent', 'simple-agent']) {
      registry.register(definition(id))
    }

    expect(registry.list().map(agent => agent.id)).toEqual([
      'multi-step-agent',
      'simple-agent',
      'tool-agent'
    ])
  })

  it('is empty before anything is registered', () => {
    expect(new InMemoryAgentRegistry().list()).toEqual([])
  })
})
