import { describe, expect, it } from 'vitest'

import { GOLDEN_RUNS } from './expected.js'
import { loadGoldens } from './goldens.js'
import { eventTypes, idsAreMonotonic, parseFrames } from './sse.js'

/**
 * The goldens are authored, so nothing regenerates them here. These assert the
 * committed bytes against the sequence contract in `expected.ts`, which is
 * derived independently from `specs/0008`.
 */
describe('the committed goldens', () => {
  const goldens = loadGoldens()

  it('exists for every byte-pinned run', () => {
    expect(goldens.size).toBe(GOLDEN_RUNS.length)
  })

  for (const run of GOLDEN_RUNS) {
    describe(run.agentId, () => {
      const frames = parseFrames(goldens.get(run.agentId) ?? '')

      it('emits the sequence specs/0008 pins, in order', () => {
        expect(eventTypes(frames)).toEqual(run.events)
      })

      it('numbers frames from one, with no gap', () => {
        expect(idsAreMonotonic(frames)).toBe(true)
      })

      it('carries one execution id throughout, derived from the request', () => {
        const ids = new Set(frames.map(frame => frame.data.executionId))

        expect(ids.size).toBe(1)
        expect([...ids][0]).toMatch(/^exec-[0-9a-f]{8}$/)
      })

      it('freezes every timestamp at the epoch', () => {
        for (const frame of frames) {
          expect(frame.data.timestamp).toBe('1970-01-01T00:00:00.000Z')
        }
      })

      it('carries no metrics block, because deterministic mode omits it', () => {
        expect(goldens.get(run.agentId)).not.toContain('"metrics"')
      })

      it('ends with a body-terminating blank line and nothing after it', () => {
        expect(goldens.get(run.agentId)?.endsWith('\n\n')).toBe(true)
      })
    })
  }
})
