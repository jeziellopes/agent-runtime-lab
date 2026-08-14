import { describe, expect, it } from 'vitest'

import {
  SseParseError,
  eventTypes,
  idsAreMonotonic,
  parseFrames
} from './sse.js'

const frame = (id: number, type: string): string =>
  `id: ${String(id)}\nevent: ${type}\ndata: {"type":"${type}","executionId":"e","timestamp":"1970-01-01T00:00:00.000Z"}\n\n`

describe('SSE frame parsing', () => {
  it('reads id, event and data in the order the contract fixes', () => {
    const [first] = parseFrames(frame(1, 'execution.created'))

    expect(first?.id).toBe(1)
    expect(first?.event).toBe('execution.created')
    expect(first?.data.executionId).toBe('e')
  })

  it('reads a whole stream in order', () => {
    const raw = frame(1, 'execution.created') + frame(2, 'execution.started')

    expect(eventTypes(parseFrames(raw))).toEqual([
      'execution.created',
      'execution.started'
    ])
  })

  it('refuses a frame whose fields are out of order', () => {
    expect(() =>
      parseFrames('event: execution.created\nid: 1\ndata: {}\n\n')
    ).toThrow(SseParseError)
  })

  it('refuses a frame with a fourth line', () => {
    expect(() =>
      parseFrames('id: 1\nevent: x\ndata: {}\nretry: 3000\n\n')
    ).toThrow(SseParseError)
  })

  it('refuses a non-integer id', () => {
    expect(() => parseFrames('id: first\nevent: x\ndata: {}\n\n')).toThrow(
      SseParseError
    )
  })

  it('detects a dropped frame through the id sequence', () => {
    const complete = parseFrames(
      frame(1, 'execution.created') + frame(2, 'execution.started')
    )
    const dropped = parseFrames(
      frame(1, 'execution.created') + frame(3, 'execution.started')
    )

    expect(idsAreMonotonic(complete)).toBe(true)
    expect(idsAreMonotonic(dropped)).toBe(false)
  })

  it('requires the sequence to start at one', () => {
    expect(idsAreMonotonic(parseFrames(frame(2, 'execution.created')))).toBe(
      false
    )
  })

  it('calls an empty stream not monotonic, having dropped everything', () => {
    expect(idsAreMonotonic([])).toBe(false)
  })
})
