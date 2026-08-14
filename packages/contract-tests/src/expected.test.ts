import { RUNTIME_EVENT_TYPES, isTerminalEvent } from '@arl/events'
import { describe, expect, it } from 'vitest'

import { EXPECTED_RUNS, GOLDEN_RUNS } from './expected.js'

import type { ExpectedRun } from './expected.js'

function runFor(agentId: string, prompt: string): ExpectedRun {
  const found = EXPECTED_RUNS.find(
    run => run.agentId === agentId && run.prompt === prompt
  )

  if (!found) {
    throw new Error(`no expected run for ${agentId} with ${prompt}`)
  }

  return found
}

const count = (events: readonly string[], type: string): number =>
  events.filter(event => event === type).length

describe('the expected event sequences', () => {
  it('covers the four runs specs/0008 pins', () => {
    expect(EXPECTED_RUNS).toHaveLength(4)
    expect(GOLDEN_RUNS).toHaveLength(3)
  })

  it('uses no event outside the twelve', () => {
    for (const run of EXPECTED_RUNS) {
      for (const event of run.events) {
        expect(RUNTIME_EVENT_TYPES).toContain(event)
      }
    }
  })

  it('opens every run with created then started', () => {
    for (const run of EXPECTED_RUNS) {
      expect(run.events.slice(0, 2)).toEqual([
        'execution.created',
        'execution.started'
      ])
    }
  })

  it('ends every run with exactly one terminal event, last', () => {
    for (const run of EXPECTED_RUNS) {
      expect(run.events.filter(isTerminalEvent)).toHaveLength(1)
      const [last] = run.events.slice(-1)

      expect(last !== undefined && isTerminalEvent(last)).toBe(true)
    }
  })

  it('gives simple-agent one model call of eight tokens', () => {
    const run = runFor('simple-agent', 'Explain what an API gateway is.')

    expect(count(run.events, 'llm.started')).toBe(1)
    expect(count(run.events, 'llm.token')).toBe(8)
    expect(count(run.events, 'tool.started')).toBe(0)
  })

  it('gives the tool branch two model calls, twelve tokens and one tool pair', () => {
    const run = runFor('tool-agent', 'Calculate 125 * 50')

    expect(count(run.events, 'llm.started')).toBe(2)
    expect(count(run.events, 'llm.completed')).toBe(2)
    expect(count(run.events, 'llm.token')).toBe(12)
    expect(count(run.events, 'tool.started')).toBe(1)
    expect(count(run.events, 'tool.completed')).toBe(1)
  })

  it('gives the direct branch six tokens and no tool call', () => {
    const run = runFor('tool-agent', 'What does API stand for?')

    expect(count(run.events, 'llm.token')).toBe(6)
    expect(count(run.events, 'tool.started')).toBe(0)
    expect(run.golden).toBe(false)
  })

  it('gives multi-step-agent three model calls and twenty tokens', () => {
    const run = runFor(
      'multi-step-agent',
      'Compare REST and GraphQL for a public API.'
    )

    expect(count(run.events, 'llm.started')).toBe(3)
    expect(count(run.events, 'llm.completed')).toBe(3)
    expect(count(run.events, 'llm.token')).toBe(20)
  })

  it('pairs every node.started with a node.completed', () => {
    for (const run of EXPECTED_RUNS) {
      expect(count(run.events, 'node.started')).toBe(
        count(run.events, 'node.completed')
      )
    }
  })
})
