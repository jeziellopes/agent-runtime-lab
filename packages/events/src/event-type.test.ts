import { describe, expect, it } from 'vitest'

import {
  RUNTIME_EVENT_TYPES,
  TERMINAL_EVENT_TYPES,
  isTerminalEvent
} from './event-type.js'

describe('the twelve runtime events', () => {
  it('is exactly twelve, and they are unique', () => {
    expect(RUNTIME_EVENT_TYPES).toHaveLength(12)
    expect(new Set(RUNTIME_EVENT_TYPES).size).toBe(12)
  })

  it('carries no tool.called, the paired form is canonical', () => {
    expect(RUNTIME_EVENT_TYPES).not.toContain('tool.called')
    expect(RUNTIME_EVENT_TYPES).toContain('tool.started')
    expect(RUNTIME_EVENT_TYPES).toContain('tool.completed')
  })

  it('carries no event for WAITING, tool.started is its trigger', () => {
    const waitingEvents = RUNTIME_EVENT_TYPES.filter(type =>
      type.includes('waiting')
    )

    expect(waitingEvents).toEqual([])
  })

  it('has three terminal events, all of them real events', () => {
    expect(TERMINAL_EVENT_TYPES).toHaveLength(3)

    for (const type of TERMINAL_EVENT_TYPES) {
      expect(RUNTIME_EVENT_TYPES).toContain(type)
      expect(isTerminalEvent(type)).toBe(true)
    }
  })

  it('treats every other event as non-terminal', () => {
    const nonTerminal = RUNTIME_EVENT_TYPES.filter(
      type => !TERMINAL_EVENT_TYPES.includes(type as 'execution.completed')
    )

    expect(nonTerminal).toHaveLength(9)

    for (const type of nonTerminal) {
      expect(isTerminalEvent(type)).toBe(false)
    }
  })
})
