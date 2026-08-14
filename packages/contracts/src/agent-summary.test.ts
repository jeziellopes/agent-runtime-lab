import { describe, expect, it } from 'vitest'

import { toAgentSummary } from './agent-summary.js'

import type { AgentDefinition } from './agent-definition.js'

const definition: AgentDefinition = {
  id: 'multi-step-agent',
  name: 'Multi-step agent',
  description: 'planner -> research -> analysis -> response',
  graph: {
    entry: 'planner',
    nodes: [
      { id: 'planner', execute: () => Promise.reject(new Error('unused')) },
      { id: 'research', execute: () => Promise.reject(new Error('unused')) }
    ],
    edges: [
      { from: 'planner', to: 'research', condition: 'needs-research' },
      { from: 'planner', to: 'response' }
    ]
  },
  tools: [
    {
      name: 'search',
      description: 'fixture-backed',
      execute: () => Promise.reject(new Error('unused'))
    }
  ]
}

describe('the agents DTO', () => {
  it('reduces nodes and tools to their identities', () => {
    const summary = toAgentSummary(definition)

    expect(summary.graph.nodes).toEqual(['planner', 'research'])
    expect(summary.tools).toEqual(['search'])
  })

  it('survives JSON without losing a field', () => {
    const summary = toAgentSummary(definition)

    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary)
  })

  it('keeps a branch label and omits the key where there is none', () => {
    const [labelled, plain] = toAgentSummary(definition).graph.edges

    expect(labelled).toEqual({
      from: 'planner',
      to: 'research',
      condition: 'needs-research'
    })
    expect(plain).toEqual({ from: 'planner', to: 'response' })
    expect(Object.keys(plain ?? {})).toEqual(['from', 'to'])
  })

  it('carries the graph, because the workflow is the claim', () => {
    expect(toAgentSummary(definition).graph.entry).toBe('planner')
  })

  it('copies the identifying fields verbatim', () => {
    const summary = toAgentSummary(definition)

    expect(summary.id).toBe('multi-step-agent')
    expect(summary.name).toBe('Multi-step agent')
    expect(summary.description).toBe(definition.description)
  })
})
