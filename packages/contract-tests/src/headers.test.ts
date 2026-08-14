import { describe, expect, it } from 'vitest'

import { headerValue, headersEqual } from './headers.js'

/**
 * `research/0001` observed the same header as `x-powered-by` under Node and
 * `X-Powered-By` under Bun, in a different position. Only an exact-string
 * suite would have called that a difference.
 */
describe('header comparison', () => {
  const node = [
    ['content-type', 'text/event-stream'],
    ['cache-control', 'no-cache']
  ] as const
  const bun = [
    ['Cache-Control', 'no-cache'],
    ['Content-Type', 'text/event-stream']
  ] as const

  it('ignores case and position', () => {
    expect(headersEqual(node, bun)).toBe(true)
  })

  it('still sees a different value', () => {
    expect(
      headersEqual(node, [
        ['Content-Type', 'text/event-stream; charset=utf-8'],
        ['Cache-Control', 'no-cache']
      ])
    ).toBe(false)
  })

  it('still sees a missing header', () => {
    expect(headersEqual(node, [['content-type', 'text/event-stream']])).toBe(
      false
    )
  })

  it('looks a header up under any casing', () => {
    expect(headerValue(bun, 'content-type')).toBe('text/event-stream')
    expect(headerValue(bun, 'CONTENT-TYPE')).toBe('text/event-stream')
    expect(headerValue(bun, 'x-absent')).toBeUndefined()
  })
})
