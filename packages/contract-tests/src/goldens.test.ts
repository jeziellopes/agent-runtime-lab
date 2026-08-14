import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { GOLDEN_RUNS } from './expected.js'
import { GoldenMissingError, loadGoldens } from './goldens.js'

describe('the golden fixtures', () => {
  it('refuses to run when one is absent, rather than reading as agreement', () => {
    expect(() => loadGoldens(mkdtempSync(join(tmpdir(), 'arl-')))).toThrow(
      GoldenMissingError
    )
  })

  it('names the file it could not find', () => {
    expect(() => loadGoldens(mkdtempSync(join(tmpdir(), 'arl-')))).toThrow(
      /simple-agent\.golden/
    )
  })

  it('refuses when only some are present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'arl-'))

    writeFileSync(join(dir, 'simple-agent.golden'), 'id: 1\n')

    expect(() => loadGoldens(dir)).toThrow(GoldenMissingError)
  })

  it('loads one golden per byte-pinned run', () => {
    const dir = mkdtempSync(join(tmpdir(), 'arl-'))

    for (const run of GOLDEN_RUNS) {
      writeFileSync(join(dir, `${run.agentId}.golden`), `id: ${run.agentId}\n`)
    }

    const goldens = loadGoldens(dir)

    expect(goldens.size).toBe(GOLDEN_RUNS.length)
    expect(goldens.get('simple-agent')).toBe('id: simple-agent\n')
  })
})
