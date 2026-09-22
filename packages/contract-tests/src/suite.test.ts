import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'

import { CELLS } from '@arl/contracts'

import type { Cell } from '@arl/contracts'
import { describe, expect, it } from 'vitest'

import {
  CONTRACT_ASSERTIONS,
  runContractAssertion,
  runContractSuite
} from './suite.js'

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

  it('is seventeen assertions', () => {
    expect(CONTRACT_ASSERTIONS).toHaveLength(17)
  })

  it('asserts a hang-up cancels, separately from a DELETE cancelling', () => {
    expect(CONTRACT_ASSERTIONS).toContain('cancel.aborts.provider.call')
    expect(CONTRACT_ASSERTIONS).toContain('cancel.on.disconnect')
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

describe('cancel.on.disconnect', () => {
  const FRAME = `id: 1\nevent: llm.token\ndata: ${JSON.stringify({
    type: 'llm.token',
    executionId: 'exec-stub',
    timestamp: '1970-01-01T00:00:00.000Z',
    data: { text: 'x' }
  })}\n\n`

  /** Serves `handler` on a free port and checks the cell that reaches it. */
  async function against(
    handler: Parameters<typeof createServer>[1],
    inspect: (check: {
      passed: boolean
      detail?: string
    }) => void | Promise<void>
  ): Promise<void> {
    const server = createServer(handler)

    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))

    try {
      const cell: Cell = {
        id: 'stub',
        framework: 'hono',
        runtime: 'node',
        port: (server.address() as AddressInfo).port
      }

      await inspect(
        await runContractAssertion('cancel.on.disconnect', cell, '127.0.0.1')
      )
    } finally {
      server.closeAllConnections()
      server.close()
    }
  }

  /** Holds one stream open and reports what it did about a hang-up. */
  function holding(cancelsOnHangUp: boolean): {
    handler: Parameters<typeof createServer>[1]
    deletes: () => number
  } {
    let status = 'running'
    let deletes = 0

    return {
      deletes: () => deletes,
      handler: (incoming, response) => {
        if (incoming.method === 'POST') {
          response.writeHead(200, { 'content-type': 'text/event-stream' })
          response.write(FRAME)
          response.on('close', () => {
            if (cancelsOnHangUp) {
              status = 'cancelled'
            }
          })

          return
        }

        if (incoming.method === 'DELETE') {
          deletes += 1
          status = 'cancelled'
          response.writeHead(204).end()

          return
        }

        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ status }))
      }
    }
  }

  it('passes against a cell that cancels on hang-up, having sent no DELETE', async () => {
    const cell = holding(true)

    await against(cell.handler, check => {
      expect(check.passed).toBe(true)
      expect(cell.deletes()).toBe(0)
    })
  }, 20_000)

  it('fails against a cell that ignores a hang-up, naming the status it read', async () => {
    const cell = holding(false)

    await against(cell.handler, check => {
      expect(check.passed).toBe(false)
      expect(check.detail).toMatch(/still read running 5000ms after/)
      expect(cell.deletes()).toBe(0)
    })
  }, 20_000)

  it('fails, not hangs, against a cell whose stream ends before a token', async () => {
    await against(
      (_incoming, response) => {
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        response.end()
      },
      check => {
        expect(check.passed).toBe(false)
        expect(check.detail).toMatch(/no llm\.token/)
      }
    )
  })

  it('fails when the token frame names no execution', async () => {
    await against(
      (_incoming, response) => {
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        response.write(
          'id: 1\nevent: llm.token\ndata: {"type":"llm.token"}\n\n'
        )
      },
      check => {
        expect(check.passed).toBe(false)
        expect(check.detail).toMatch(/named no execution/)
      }
    )
  })
})
