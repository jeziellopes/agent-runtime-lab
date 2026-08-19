import 'reflect-metadata'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { REFERENCE_AGENTS } from '@arl/agents'
import {
  AgentNotFoundError,
  ExecutionStatus,
  ProviderError,
  RateLimitedError,
  ToolError
} from '@arl/contracts'
import { createRuntime } from '@arl/runtime-core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createNestApp } from './app.js'

import type { AgentRuntime, AgentSummary, RuntimeConfig } from '@arl/contracts'
import type { RuntimeEvent } from '@arl/events'
import type { NestExpressApplication } from '@nestjs/platform-express'

const CONFIG: RuntimeConfig = {
  defaultModel: 'authored',
  maxIterations: 10,
  timeoutMs: 30_000,
  llmMode: 'replay',
  maxRetries: 3,
  deterministic: true,
  fixtureSet: 'contract'
}

const GOLDENS = join(
  __dirname,
  '..',
  '..',
  '..',
  'packages',
  'contract-tests',
  'fixtures',
  'sse'
)

const SIMPLE = 'Explain what an API gateway is.'

/** Not everything thrown in JavaScript is an `Error`, and the filter says so. */
const NOT_AN_ERROR: unknown = 'a bare string'

const running: NestExpressApplication[] = []

afterEach(async () => {
  await Promise.all(running.splice(0).map(app => app.close()))
})

/**
 * Over real HTTP rather than an in-process harness: the SSE criteria are about
 * bytes on a socket, and the framing is exactly where an in-process shortcut
 * would stop proving anything.
 */
async function cell(runtime?: AgentRuntime): Promise<string> {
  const app = await createNestApp(
    runtime ?? createRuntime(CONFIG, REFERENCE_AGENTS)
  )

  running.push(app)
  await app.listen(0)

  return app.getUrl()
}

async function post(
  base: string,
  path: string,
  body: unknown,
  sent: { raw?: string; contentType?: string } = {}
): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': sent.contentType ?? 'application/json' },
    body: sent.raw ?? JSON.stringify(body)
  })
}

/** Opens an execution, or opens nothing, and then holds the connection. */
async function* held(open: boolean): AsyncIterable<RuntimeEvent> {
  if (open) {
    yield {
      type: 'execution.created',
      executionId: 'exec-held',
      timestamp: new Date(0),
      data: { agentId: 'simple-agent' }
    }
  }

  await new Promise(resolve => setTimeout(resolve, 5_000))
}

/** Only what a handler reaches; each test overrides the one method it drives. */
function stub(overrides: Partial<AgentRuntime>): AgentRuntime {
  return {
    execute: () => Promise.reject(new Error('unexpected execute')),
    stream: () => {
      throw new Error('unexpected stream')
    },
    getExecution: () => Promise.resolve(null),
    cancel: () => Promise.resolve(),
    listAgents: () => Promise.resolve([]),
    ...overrides
  }
}

describe('GET /health', () => {
  it('answers ok with an uptime', async () => {
    const response = await fetch(`${await cell()}/health`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' })
  })

  it('never reaches the runtime', async () => {
    const base = await cell(
      stub({
        listAgents: () => Promise.reject(new Error('the runtime is down'))
      })
    )

    expect((await fetch(`${base}/health`)).status).toBe(200)
  })
})

describe('GET /agents', () => {
  it('summarises all three, sorted by id', async () => {
    const response = await fetch(`${await cell()}/agents`)
    const summaries = (await response.json()) as AgentSummary[]

    expect(response.status).toBe(200)
    expect(summaries.map(summary => summary.id)).toEqual([
      'multi-step-agent',
      'simple-agent',
      'tool-agent'
    ])
    expect(summaries[2]?.tools).toEqual(['calculator', 'search'])
    expect(summaries[1]?.graph.nodes).toEqual(['llm', 'response'])
  })

  it('carries names where the definition carries objects', async () => {
    const response = await fetch(`${await cell()}/agents`)

    for (const summary of (await response.json()) as AgentSummary[]) {
      expect(Object.keys(summary)).toEqual([
        'id',
        'name',
        'description',
        'tools',
        'graph'
      ])
      expect(summary.tools.every(tool => typeof tool === 'string')).toBe(true)
      expect(summary.graph.nodes.every(node => typeof node === 'string')).toBe(
        true
      )
    }
  })
})

describe('POST /agents/:id/execute', () => {
  it('completes and reports the answer', async () => {
    const response = await post(await cell(), '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE }
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      executionId: 'exec-d29f2d32',
      status: ExecutionStatus.COMPLETED,
      output: { text: 'An API gateway routes requests to backend services.' }
    })
  })

  it('omits metrics under deterministic mode', async () => {
    const response = await post(await cell(), '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE }
    })

    expect(Object.keys((await response.json()) as object)).toEqual([
      'executionId',
      'status',
      'output',
      'usage'
    ])
  })

  it('accepts unknown extra fields', async () => {
    const response = await post(await cell(), '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE },
      unheardOf: true
    })

    expect(response.status).toBe(200)
  })

  it('refuses an unregistered agent', async () => {
    const response = await post(await cell(), '/agents/ghost/execute', {
      input: { prompt: SIMPLE }
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: 'agent_not_found'
    })
  })

  it.each([
    ['no input', {}],
    ['no prompt', { input: {} }],
    ['a numeric prompt', { input: { prompt: 42 } }],
    ['an empty prompt', { input: { prompt: '' } }],
    ['an array input', { input: [] }],
    ['a numeric sessionId', { input: { prompt: SIMPLE }, sessionId: 1 }],
    ['a string metadata', { input: { prompt: SIMPLE }, metadata: 'no' }]
  ])('refuses %s', async (_case, body) => {
    const response = await post(
      await cell(),
      '/agents/simple-agent/execute',
      body
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid_request'
    })
  })

  it('accepts a sessionId and metadata', async () => {
    const response = await post(await cell(), '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE },
      sessionId: 'session-1',
      metadata: { seen: true }
    })

    expect(response.status).toBe(200)
  })

  it('refuses a malformed JSON body with its own shape', async () => {
    const response = await post(
      await cell(),
      '/agents/simple-agent/execute',
      undefined,
      { raw: '{"input":' }
    )

    expect(response.status).toBe(400)
    expect(Object.keys((await response.json()) as object)).toEqual([
      'error',
      'detail'
    ])
  })

  it('parses the body whatever the content type claims', async () => {
    const response = await post(
      await cell(),
      '/agents/simple-agent/execute',
      { input: { prompt: SIMPLE } },
      { contentType: 'text/plain' }
    )

    expect(response.status).toBe(200)
  })
})

describe('the error wire', () => {
  it.each([
    [new AgentNotFoundError('no such agent'), 404],
    [new ToolError('the calculator refused'), 422],
    [new ProviderError('the provider is down'), 503]
  ])('maps %s to its status', async (failure, status) => {
    const base = await cell(stub({ execute: () => Promise.reject(failure) }))
    const response = await post(base, '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE }
    })

    expect(response.status).toBe(status)
    expect(Object.keys((await response.json()) as object)).toEqual([
      'error',
      'detail'
    ])
  })

  it('carries retryAfter in the body and the header on a 429', async () => {
    const base = await cell(
      stub({
        execute: () => Promise.reject(new RateLimitedError('slow down', 30))
      })
    )
    const response = await post(base, '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE }
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('30')
    await expect(response.json()).resolves.toEqual({
      error: 'rate_limited',
      detail: 'slow down',
      retryAfter: 30
    })
  })

  it('omits retryAfter when the limit named no delay', async () => {
    const base = await cell(
      stub({ execute: () => Promise.reject(new RateLimitedError('slow down')) })
    )
    const response = await post(base, '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE }
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBeNull()
    await expect(response.json()).resolves.toEqual({
      error: 'rate_limited',
      detail: 'slow down'
    })
  })

  it('gives an adapter defect the runtime shape rather than a 500 page', async () => {
    const base = await cell(
      stub({ execute: () => Promise.reject(new Error('a bug in here')) })
    )
    const response = await post(base, '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE }
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: 'agent_error',
      detail: 'a bug in here'
    })
  })

  it('reports something thrown that was never an Error', async () => {
    const base = await cell(
      stub({ execute: () => Promise.reject(NOT_AN_ERROR) })
    )
    const response = await post(base, '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE }
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: 'agent_error',
      detail: 'a bare string'
    })
  })

  it('leaves an unmatched route to the framework', async () => {
    const response = await fetch(`${await cell()}/nothing-here`)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.not.toHaveProperty('detail')
  })
})

describe('GET and DELETE /executions/:id', () => {
  it('returns the execution with an ISO createdAt', async () => {
    const base = await cell()

    await post(base, '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE }
    })

    const response = await fetch(`${base}/executions/exec-d29f2d32`)
    const execution = (await response.json()) as { createdAt: string }

    expect(response.status).toBe(200)
    expect(execution.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    )
  })

  it('refuses an unknown execution', async () => {
    const response = await fetch(`${await cell()}/executions/exec-nothing`)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: 'execution_not_found'
    })
  })

  it.each([
    ['a known execution', 'exec-d29f2d32'],
    ['an id that never existed', 'exec-nothing']
  ])('answers 204 with an empty body for %s', async (_case, id) => {
    const base = await cell()

    await post(base, '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE }
    })

    const response = await fetch(`${base}/executions/${id}`, {
      method: 'DELETE'
    })

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
  })
})

describe('POST /agents/:id/stream', () => {
  async function streamOf(agentId: string, prompt: string): Promise<string> {
    const response = await post(await cell(), `/agents/${agentId}/stream`, {
      input: { prompt }
    })

    return response.text()
  }

  it('pins the response headers', async () => {
    const response = await post(await cell(), '/agents/simple-agent/stream', {
      input: { prompt: SIMPLE }
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(response.headers.get('cache-control')).toBe('no-cache')
    await response.text()
  })

  it('writes the first frame byte for byte', async () => {
    const body = await streamOf('simple-agent', SIMPLE)

    expect(body.split('\n\n')[0]).toBe(
      'id: 1\nevent: execution.created\ndata: {"type":"execution.created","executionId":"exec-d29f2d32","timestamp":"1970-01-01T00:00:00.000Z","data":{"agentId":"simple-agent"}}'
    )
  })

  it.each([
    ['simple-agent', SIMPLE],
    ['tool-agent', 'Calculate 125 * 50'],
    ['multi-step-agent', 'Compare REST and GraphQL for a public API.']
  ])('matches the %s golden', async (agentId, prompt) => {
    expect(await streamOf(agentId, prompt)).toBe(
      readFileSync(join(GOLDENS, `${agentId}.golden`), 'utf8')
    )
  })

  it('carries no retry field and ends on a terminal event', async () => {
    const body = await streamOf('simple-agent', SIMPLE)
    const events = [...body.matchAll(/^event: (.+)$/gm)].map(match => match[1])

    expect(body).not.toContain('retry:')
    expect(events.at(-1)).toBe('execution.completed')
  })

  it('reports a mid-stream failure as an event and still answers 200', async () => {
    const response = await post(await cell(), '/agents/simple-agent/stream', {
      input: { prompt: '__fail_midstream__' }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('event: execution.failed')
  })

  it.each([
    ['an unregistered agent', 'ghost', { input: { prompt: SIMPLE } }, 404],
    ['an invalid input', 'simple-agent', { input: {} }, 400]
  ])('refuses %s before any frame', async (_case, agentId, body, status) => {
    const response = await post(await cell(), `/agents/${agentId}/stream`, body)

    expect(response.status).toBe(status)
    expect(await response.text()).not.toContain('event:')
  })

  it('writes no status when the stream itself fails after the headers', async () => {
    const base = await cell(
      stub({
        stream: () =>
          (async function* broken(): AsyncIterable<RuntimeEvent> {
            yield {
              type: 'execution.started',
              executionId: 'exec-broken',
              timestamp: new Date(0)
            }

            throw new Error('the stream came apart')
          })()
      })
    )
    const response = await post(base, '/agents/simple-agent/stream', {
      input: { prompt: SIMPLE }
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('event: execution.started')
  })
})

describe('a client that hangs up', () => {
  async function disconnect(open: boolean): Promise<string | undefined> {
    let cancelled: string | undefined
    const base = await cell(
      stub({
        stream: () => held(open),
        cancel: id => {
          cancelled = id

          return Promise.resolve()
        }
      })
    )
    const controller = new AbortController()
    const response = await fetch(`${base}/agents/simple-agent/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: { prompt: SIMPLE } }),
      signal: controller.signal
    })

    if (open) {
      await response.body?.getReader().read()
    }

    controller.abort()
    await vi.waitFor(() => {
      expect(open ? cancelled : true).toBeTruthy()
    })

    return cancelled
  }

  it('cancels the execution it had already opened', async () => {
    await expect(disconnect(true)).resolves.toBe('exec-held')
  })

  it('cancels nothing when no execution had been reported yet', async () => {
    await expect(disconnect(false)).resolves.toBeUndefined()
  })
})

describe('what no response carries', () => {
  it.each(['/health', '/agents'])('sends no x-powered-by on %s', async path => {
    const response = await fetch(`${await cell()}${path}`)

    expect(response.headers.get('x-powered-by')).toBeNull()
    await response.text()
  })
})
