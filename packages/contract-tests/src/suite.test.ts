import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CELLS } from '@arl/contracts'
import { describe, expect, it } from 'vitest'

import { GoldenMissingError } from './goldens.js'
import { CONTRACT_ASSERTIONS, runContractSuite } from './suite.js'

describe('the equivalence gate', () => {
  it('enumerates one assertion per endpoint on the surface', () => {
    const endpoints = [
      'health.response',
      'agents.list',
      'agents.execute',
      'agents.stream',
      'executions.get',
      'executions.cancel'
    ]

    expect(CONTRACT_ASSERTIONS).toEqual(expect.arrayContaining(endpoints))
    expect(new Set(CONTRACT_ASSERTIONS).size).toBe(CONTRACT_ASSERTIONS.length)
  })

  it('is sixteen assertions', () => {
    expect(CONTRACT_ASSERTIONS).toHaveLength(16)
  })

  it('asserts SSE on the bytes, not on a normalised event object', () => {
    expect(CONTRACT_ASSERTIONS).toContain('sse.framing.bytes')
    expect(CONTRACT_ASSERTIONS).toContain('sse.event.id.monotonic')
  })

  it('asserts a mid-stream error is an event and not a status code', () => {
    expect(CONTRACT_ASSERTIONS).toContain('error.midstream.is.event.not.status')
  })

  it('asserts deterministic mode carries no timing block', () => {
    expect(CONTRACT_ASSERTIONS).toContain('deterministic.omits.metrics')
  })

  it('cannot run: the goldens it compares against are not authored yet', async () => {
    for (const cell of CELLS) {
      await expect(runContractSuite(cell)).rejects.toThrow(GoldenMissingError)
    }
  })
})

describe('the suite imports no framework package', () => {
  it('declares none, because the prohibition is its premise', () => {
    const manifest = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
    ) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }

    const declared = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {})
    ]

    for (const forbidden of [
      '@nestjs/core',
      '@nestjs/common',
      'hono',
      '@hono/node-server',
      'express',
      'fastify'
    ]) {
      expect(declared).not.toContain(forbidden)
    }
  })
})
