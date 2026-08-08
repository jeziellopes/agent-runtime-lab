import { describe, expect, it } from 'vitest'

import {
  EXECUTION_TRANSITIONS,
  ExecutionStatus,
  TERMINAL_STATUSES,
  canTransition,
  isTerminalStatus
} from './execution-status.js'

const ALL = Object.values(ExecutionStatus)

describe('the seven-state execution lifecycle', () => {
  it('is exactly seven states', () => {
    expect(ALL).toHaveLength(7)
    expect(new Set(ALL).size).toBe(7)
  })

  it('has no PROCESSING state', () => {
    expect(ALL).not.toContain('processing')
    expect(Object.keys(ExecutionStatus)).not.toContain('PROCESSING')
  })

  it('describes a transition for every state, and only for real states', () => {
    expect(Object.keys(EXECUTION_TRANSITIONS).sort()).toEqual([...ALL].sort())

    for (const targets of Object.values(EXECUTION_TRANSITIONS)) {
      for (const target of targets) {
        expect(ALL).toContain(target)
      }
    }
  })

  it('leaves the three terminal states with nowhere to go', () => {
    expect(TERMINAL_STATUSES).toHaveLength(3)

    for (const status of TERMINAL_STATUSES) {
      expect(isTerminalStatus(status)).toBe(true)
      expect(EXECUTION_TRANSITIONS[status]).toEqual([])
    }
  })

  it('keeps every non-terminal state non-terminal and moving', () => {
    const open = ALL.filter(status => !isTerminalStatus(status))

    expect(open).toHaveLength(4)

    for (const status of open) {
      expect(EXECUTION_TRANSITIONS[status].length).toBeGreaterThan(0)
    }
  })

  it('walks the canonical happy path', () => {
    expect(
      canTransition(ExecutionStatus.CREATED, ExecutionStatus.INITIALIZING)
    ).toBe(true)
    expect(
      canTransition(ExecutionStatus.INITIALIZING, ExecutionStatus.RUNNING)
    ).toBe(true)
    expect(
      canTransition(ExecutionStatus.RUNNING, ExecutionStatus.COMPLETED)
    ).toBe(true)
  })

  it('cycles RUNNING <-> WAITING around a tool await', () => {
    expect(
      canTransition(ExecutionStatus.RUNNING, ExecutionStatus.WAITING)
    ).toBe(true)
    expect(
      canTransition(ExecutionStatus.WAITING, ExecutionStatus.RUNNING)
    ).toBe(true)
  })

  it('reaches CANCELLED from every non-terminal state', () => {
    const open = ALL.filter(status => !isTerminalStatus(status))

    for (const status of open) {
      expect(canTransition(status, ExecutionStatus.CANCELLED)).toBe(true)
    }
  })

  it('refuses to skip INITIALIZING or to resurrect a terminal execution', () => {
    expect(
      canTransition(ExecutionStatus.CREATED, ExecutionStatus.RUNNING)
    ).toBe(false)
    expect(
      canTransition(ExecutionStatus.COMPLETED, ExecutionStatus.RUNNING)
    ).toBe(false)
  })
})
