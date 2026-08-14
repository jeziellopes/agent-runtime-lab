import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { GOLDEN_RUNS } from './expected.js'

/**
 * The complete raw response body of `POST /agents/:id/stream`, one file per
 * reference agent, byte for byte.
 *
 * Authored from `specs/0007` and `specs/0008`, never recorded from a running
 * adapter: a captured golden encodes whatever that adapter happens to do, which
 * is the degradation the suite exists to prevent.
 */
export const GOLDENS_DIR = join(__dirname, '..', 'fixtures', 'sse')

export class GoldenMissingError extends Error {}

export function loadGoldens(dir: string = GOLDENS_DIR): Map<string, string> {
  const goldens = new Map<string, string>()

  for (const run of GOLDEN_RUNS) {
    const path = join(dir, `${run.agentId}.golden`)

    try {
      goldens.set(run.agentId, readFileSync(path, 'utf8'))
    } catch {
      throw new GoldenMissingError(
        `no golden at ${path}: an absent expectation must never read as agreement`
      )
    }
  }

  return goldens
}
