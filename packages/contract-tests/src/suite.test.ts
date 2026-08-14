import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CELLS } from '@arl/contracts'

import type { Cell } from '@arl/contracts'
import { describe, expect, it } from 'vitest'

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

  it('reports one check per assertion, in declaration order', async () => {
    const report = await runContractSuite(CELLS[0] as Cell)

    expect(report.checks).toHaveLength(CONTRACT_ASSERTIONS.length)
    expect(report.checks.map(check => check.id)).toEqual([
      ...CONTRACT_ASSERTIONS
    ])
  })

  it('fails against a cell that does not implement the contract', async () => {
    const report = await runContractSuite(CELLS[0] as Cell)

    expect(report.passed).toBe(false)
  })

  it('names what differed on every failed check, never a bare false', async () => {
    const report = await runContractSuite(CELLS[0] as Cell)

    for (const check of report.checks.filter(candidate => !candidate.passed)) {
      expect(check.detail).toBeTruthy()
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
