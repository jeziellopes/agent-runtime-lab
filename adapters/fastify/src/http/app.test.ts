import { readdirSync, readFileSync } from 'node:fs'
import { request as httpRequest, Agent } from 'node:http'
import type { IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
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

import { BODY_LIMIT_BYTES, createApp } from './app.js'

import type { auth } from './middleware/auth.js'
import type { AgentRuntime, AgentSummary, RuntimeConfig } from '@arl/contracts'
import type { RuntimeEvent } from '@arl/events'
import type { FastifyInstance } from 'fastify'

const seenByAuth = vi.hoisted(() => vi.fn<(url: string) => void>())

vi.mock('./middleware/auth.js', async importOriginal => {
  const original = await importOriginal<{ auth: typeof auth }>()

  return {
    auth: (): ReturnType<typeof auth> => {
      const hook = original.auth()

      return (request, reply, done) => {
        seenByAuth(request.url)
        hook.call(reply.server, request, reply, done)
      }
    }
  }
})

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
  '..',
  'packages',
  'contract-tests',
  'fixtures',
  'sse'
)

const SIMPLE = 'Explain what an API gateway is.'

const opened: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(opened.splice(0).map(instance => instance.close()))
})

function app(runtime?: AgentRuntime): FastifyInstance {
  const instance = createApp({
    runtime: runtime ?? createRuntime(CONFIG, REFERENCE_AGENTS)
  })

  opened.push(instance)

  return instance
}

function post(
  instance: FastifyInstance,
  url: string,
  body: unknown,
  raw?: string
) {
  return instance.inject({
    method: 'POST',
    url,
    headers: { 'content-type': 'application/json' },
    payload: raw ?? JSON.stringify(body)
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
    const response = await app().inject('/health')

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'ok' })
  })

  it('never reaches the runtime', async () => {
    const response = await app(
      stub({
        listAgents: () => Promise.reject(new Error('the runtime is down'))
      })
    ).inject('/health')

    expect(response.statusCode).toBe(200)
  })
})

describe('GET /agents', () => {
  it('summarises all three, sorted by id', async () => {
    const response = await app().inject('/agents')
    const summaries =
      response.json<
        { id: string; tools: string[]; graph: { nodes: string[] } }[]
      >()

    expect(response.statusCode).toBe(200)
    expect(summaries.map(summary => summary.id)).toEqual([
      'multi-step-agent',
      'simple-agent',
      'tool-agent'
    ])
    expect(summaries[2]?.tools).toEqual(['calculator', 'search'])
    expect(summaries[1]?.graph.nodes).toEqual(['llm', 'response'])
  })

  it('carries names where the definition carries objects', async () => {
    const response = await app().inject('/agents')

    for (const summary of response.json<AgentSummary[]>()) {
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
    const response = await post(app(), '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      executionId: 'exec-d29f2d32',
      status: ExecutionStatus.COMPLETED,
      output: { text: 'An API gateway routes requests to backend services.' }
    })
  })

  it('omits metrics under deterministic mode', async () => {
    const response = await post(app(), '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE }
    })

    expect(Object.keys(response.json<object>())).toEqual([
      'executionId',
      'status',
      'output',
      'usage'
    ])
  })

  it('accepts unknown extra fields', async () => {
    const response = await post(app(), '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE },
      unheardOf: true
    })

    expect(response.statusCode).toBe(200)
  })

  it('refuses an unregistered agent', async () => {
    const response = await post(app(), '/agents/ghost/execute', {
      input: { prompt: SIMPLE }
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ error: 'agent_not_found' })
  })

  it.each([
    ['no input', {}],
    ['no prompt', { input: {} }],
    ['a numeric prompt', { input: { prompt: 42 } }],
    ['an empty prompt', { input: { prompt: '' } }]
  ])('refuses %s', async (_case, body) => {
    const response = await post(app(), '/agents/simple-agent/execute', body)

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: 'invalid_request' })
  })

  it('refuses a malformed JSON body with its own shape', async () => {
    const response = await post(
      app(),
      '/agents/simple-agent/execute',
      undefined,
      '{"input":'
    )

    expect(response.statusCode).toBe(400)
    expect(Object.keys(response.json<object>())).toEqual(['error', 'detail'])
  })

  it('refuses a request with no body at all', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/agents/simple-agent/execute'
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: 'invalid_request' })
  })
})

describe('what the content type claims', () => {
  it.each([
    ['text/plain', { 'content-type': 'text/plain' }],
    [
      'application/x-www-form-urlencoded',
      { 'content-type': 'application/x-www-form-urlencoded' }
    ],
    ['no content type', {}]
  ])('parses the body sent as %s', async (_case, headers) => {
    const response = await app().inject({
      method: 'POST',
      url: '/agents/simple-agent/execute',
      headers,
      payload: JSON.stringify({ input: { prompt: SIMPLE } })
    })

    expect(response.statusCode).toBe(200)
  })

  it.each([
    'application/json',
    'text/plain',
    'application/xml',
    'application/octet-stream',
    'multipart/form-data; boundary=x'
  ])('never answers a POST with 415 for %s', async type => {
    const response = await app().inject({
      method: 'POST',
      url: '/agents/simple-agent/execute',
      headers: { 'content-type': type },
      payload: JSON.stringify({ input: { prompt: SIMPLE } })
    })

    expect(response.statusCode).not.toBe(415)
  })
})

describe('the body size', () => {
  it('is limited to exactly 2 MiB', () => {
    expect(app().initialConfig.bodyLimit).toBe(2 * 1024 * 1024)
    expect(BODY_LIMIT_BYTES).toBe(2_097_152)
  })

  it('accepts the 50000-token long-context prompt, intact', async () => {
    const prompt = 'lorem '.repeat(50_000).trim()
    const received: string[] = []
    const response = await post(
      app(
        stub({
          execute: request => {
            received.push((request.input as { prompt: string }).prompt)

            return Promise.resolve({
              executionId: 'exec-long',
              status: ExecutionStatus.COMPLETED,
              output: { text: 'ok' }
            })
          }
        })
      ),
      '/agents/simple-agent/execute',
      { input: { prompt } }
    )

    expect(prompt.length).toBeGreaterThan(299_000)
    expect(response.statusCode).toBe(200)
    expect(received).toEqual([prompt])
  })

  it('accepts a body just under the limit', async () => {
    const response = await post(
      app(
        stub({
          execute: () =>
            Promise.resolve({
              executionId: 'exec-large',
              status: ExecutionStatus.COMPLETED,
              output: { text: 'ok' }
            })
        })
      ),
      '/agents/simple-agent/execute',
      { input: { prompt: 'x'.repeat(BODY_LIMIT_BYTES - 1024) } }
    )

    expect(response.statusCode).toBe(200)
  })

  it('refuses a body above the limit without reaching the runtime', async () => {
    const execute = vi.fn(() => Promise.reject(new Error('unexpected')))
    const response = await post(
      app(stub({ execute })),
      '/agents/simple-agent/execute',
      { input: { prompt: 'x'.repeat(BODY_LIMIT_BYTES) } }
    )

    expect(response.statusCode).toBeGreaterThanOrEqual(400)
    expect(execute).not.toHaveBeenCalled()
  })
})

describe('the error wire', () => {
  it.each([
    [new AgentNotFoundError('no such agent'), 404],
    [new ToolError('the calculator refused'), 422],
    [new ProviderError('the provider is down'), 503]
  ])('maps %s to its status', async (failure, status) => {
    const response = await post(
      app(stub({ execute: () => Promise.reject(failure) })),
      '/agents/simple-agent/execute',
      { input: { prompt: SIMPLE } }
    )

    expect(response.statusCode).toBe(status)
    expect(Object.keys(response.json<object>())).toEqual(['error', 'detail'])
  })

  it('carries retryAfter in the body and the header on a 429', async () => {
    const response = await post(
      app(
        stub({
          execute: () => Promise.reject(new RateLimitedError('slow down', 30))
        })
      ),
      '/agents/simple-agent/execute',
      { input: { prompt: SIMPLE } }
    )

    expect(response.statusCode).toBe(429)
    expect(response.headers['retry-after']).toBe('30')
    expect(response.json()).toEqual({
      error: 'rate_limited',
      detail: 'slow down',
      retryAfter: 30
    })
  })

  it('omits retryAfter when the limit named no delay', async () => {
    const response = await post(
      app(
        stub({
          execute: () => Promise.reject(new RateLimitedError('slow down'))
        })
      ),
      '/agents/simple-agent/execute',
      { input: { prompt: SIMPLE } }
    )

    expect(response.statusCode).toBe(429)
    expect(response.headers['retry-after']).toBeUndefined()
    expect(response.json()).toEqual({
      error: 'rate_limited',
      detail: 'slow down'
    })
  })

  it('names the root when the body is not an object at all', async () => {
    const response = await post(app(), '/agents/simple-agent/execute', [])

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: 'invalid_request' })
  })

  it('gives an adapter defect the runtime shape rather than a 500 page', async () => {
    const response = await post(
      app(stub({ execute: () => Promise.reject(new Error('a bug in here')) })),
      '/agents/simple-agent/execute',
      { input: { prompt: SIMPLE } }
    )

    expect(response.statusCode).toBe(422)
    expect(response.json()).toEqual({
      error: 'agent_error',
      detail: 'a bug in here'
    })
  })

  it('gives a thrown value that is not an Error the same shape', async () => {
    const response = await post(
      app(stub({ execute: () => Promise.reject('plain string') })),
      '/agents/simple-agent/execute',
      { input: { prompt: SIMPLE } }
    )

    expect(response.statusCode).toBe(422)
    expect(response.json()).toEqual({
      error: 'agent_error',
      detail: 'plain string'
    })
  })
})

describe('GET and DELETE /executions/:id', () => {
  it('returns the execution with an ISO createdAt', async () => {
    const cell = app()

    await post(cell, '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE }
    })

    const response = await cell.inject('/executions/exec-d29f2d32')

    expect(response.statusCode).toBe(200)
    expect(response.json<{ createdAt: string }>().createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    )
  })

  it('refuses an unknown execution', async () => {
    const response = await app().inject('/executions/exec-nothing')

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ error: 'execution_not_found' })
  })

  it.each([
    ['a known execution', 'exec-d29f2d32'],
    ['an id that never existed', 'exec-nothing']
  ])('answers 204 with an empty body for %s', async (_case, id) => {
    const response = await app().inject({
      method: 'DELETE',
      url: `/executions/${id}`
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe('')
  })
})

describe('POST /agents/:id/stream', () => {
  async function streamOf(agentId: string, prompt: string): Promise<string> {
    const response = await post(app(), `/agents/${agentId}/stream`, {
      input: { prompt }
    })

    return response.body
  }

  it('pins the response headers', async () => {
    const response = await post(app(), '/agents/simple-agent/stream', {
      input: { prompt: SIMPLE }
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('text/event-stream')
    expect(response.headers['cache-control']).toBe('no-cache')
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

  it('numbers frames from one within each execution', async () => {
    const first = await streamOf('simple-agent', SIMPLE)
    const second = await streamOf('tool-agent', 'Calculate 125 * 50')
    const idsOf = (body: string): number[] =>
      [...body.matchAll(/^id: (\d+)$/gm)].map(match => Number(match[1]))

    expect(idsOf(first)).toEqual(idsOf(first).map((_value, index) => index + 1))
    expect(idsOf(second)[0]).toBe(1)
  })

  it('carries no retry field and ends on a terminal event', async () => {
    const body = await streamOf('simple-agent', SIMPLE)
    const events = [...body.matchAll(/^event: (.+)$/gm)].map(match => match[1])

    expect(body).not.toContain('retry:')
    expect(events.at(-1)).toBe('execution.completed')
  })

  it('parses each frame to the event its event line names', async () => {
    const body = await streamOf('simple-agent', SIMPLE)

    for (const frame of body.split('\n\n').filter(part => part.length > 0)) {
      const [, name, payload] = frame.split('\n')
      const event = JSON.parse(
        (payload ?? '').replace('data: ', '')
      ) as RuntimeEvent

      expect(`event: ${event.type}`).toBe(name)
    }
  })

  it('reports a mid-stream failure as an event and still answers 200', async () => {
    const response = await post(app(), '/agents/simple-agent/stream', {
      input: { prompt: '__fail_midstream__' }
    })

    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('event: execution.failed')
    expect(response.body.trimEnd().endsWith('}')).toBe(true)
  })

  it('ends the response, without a status, when the stream itself throws', async () => {
    async function* broken(): AsyncIterable<RuntimeEvent> {
      yield {
        type: 'execution.created',
        executionId: 'exec-broken',
        timestamp: new Date(0),
        data: { agentId: 'simple-agent' }
      }

      await Promise.resolve()
      throw new Error('the stream broke')
    }

    const response = await post(
      app(stub({ stream: () => broken() })),
      '/agents/simple-agent/stream',
      { input: { prompt: SIMPLE } }
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('event: execution.created')
    expect(response.body).not.toContain('agent_error')
  })

  it.each([
    ['an unregistered agent', 'ghost', { input: { prompt: SIMPLE } }, 404],
    ['an invalid input', 'simple-agent', { input: {} }, 400]
  ])('refuses %s before any frame', async (_case, agentId, body, status) => {
    const response = await post(app(), `/agents/${agentId}/stream`, body)

    expect(response.statusCode).toBe(status)
    expect(response.body).not.toContain('event:')
  })
})

describe('a client that hangs up', () => {
  const connections = new Agent({ keepAlive: false })

  async function listening(instance: FastifyInstance): Promise<number> {
    await instance.listen({ port: 0, host: '127.0.0.1' })

    return (instance.server.address() as AddressInfo).port
  }

  function open(port: number, prompt: string): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      const outgoing = httpRequest(
        {
          port,
          host: '127.0.0.1',
          method: 'POST',
          path: '/agents/simple-agent/stream',
          agent: connections,
          headers: { 'content-type': 'application/json' }
        },
        resolve
      )

      outgoing.on('error', reject)
      outgoing.end(JSON.stringify({ input: { prompt } }))
    })
  }

  /** Reads until `stop` matches what has arrived, or the stream ends. */
  function readUntil(response: IncomingMessage, stop: RegExp): Promise<string> {
    return new Promise(resolve => {
      let received = ''

      response.setEncoding('utf8')
      response.on('data', (chunk: string) => {
        received += chunk

        if (stop.test(received)) {
          resolve(received)
        }
      })
      response.on('end', () => {
        resolve(received)
      })
    })
  }

  async function until(condition: () => Promise<boolean>): Promise<void> {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (await condition()) {
        return
      }

      await new Promise(resolve => setTimeout(resolve, 25))
    }

    throw new Error('the condition never held')
  }

  async function drained(instance: FastifyInstance): Promise<void> {
    await until(
      () =>
        new Promise(resolve => {
          instance.server.getConnections((_error, count) => {
            resolve(count === 0)
          })
        })
    )
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  it('cancels the execution with no DELETE issued', async () => {
    const runtime = createRuntime(CONFIG, REFERENCE_AGENTS)
    const instance = app(runtime)
    const port = await listening(instance)
    const response = await open(port, '__hold__')
    const frames = await readUntil(response, /event: llm\.token/)
    const executionId = /"executionId":"([^"]+)"/.exec(frames)?.[1] ?? ''

    expect(executionId).not.toBe('')
    await expect(runtime.getExecution(executionId)).resolves.toMatchObject({
      status: ExecutionStatus.RUNNING
    })

    response.destroy()

    await until(
      async () =>
        (await runtime.getExecution(executionId))?.status ===
        ExecutionStatus.CANCELLED
    )
  })

  it('cancels the execution it had already opened, once', async () => {
    const cancel = vi.fn(() => Promise.resolve())
    const instance = app(stub({ stream: () => held(true), cancel }))
    const port = await listening(instance)
    const response = await open(port, SIMPLE)

    await readUntil(response, /execution\.created/)
    response.destroy()
    await drained(instance)

    expect(cancel).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledWith('exec-held')
  })

  it('cancels nothing when no execution had been reported yet', async () => {
    const cancel = vi.fn(() => Promise.resolve())
    const instance = app(stub({ stream: () => held(false), cancel }))
    const port = await listening(instance)
    const response = await open(port, SIMPLE)

    response.destroy()
    await drained(instance)

    expect(cancel).not.toHaveBeenCalled()
  })

  it('cancels nothing after the stream has finished', async () => {
    const cancel = vi.fn(() => Promise.resolve())
    const instance = app(createRuntimeWithCancel(cancel))
    const port = await listening(instance)
    const response = await open(port, SIMPLE)

    await expect(readUntil(response, /never matches/)).resolves.toContain(
      'execution.completed'
    )
    await drained(instance)

    expect(cancel).not.toHaveBeenCalled()
  })

  function createRuntimeWithCancel(
    cancel: AgentRuntime['cancel']
  ): AgentRuntime {
    const real = createRuntime(CONFIG, REFERENCE_AGENTS)

    return {
      execute: request => real.execute(request),
      stream: request => real.stream(request),
      getExecution: id => real.getExecution(id),
      listAgents: () => real.listAgents(),
      cancel
    }
  }
})

describe('the factory', () => {
  it('returns two independent instances', async () => {
    const first = app()
    const second = app()

    expect(first).not.toBe(second)

    await post(first, '/agents/simple-agent/execute', {
      input: { prompt: SIMPLE }
    })

    expect((await first.inject('/executions/exec-d29f2d32')).statusCode).toBe(
      200
    )
    expect((await second.inject('/executions/exec-d29f2d32')).statusCode).toBe(
      404
    )
  })
})

describe('the auth slot', () => {
  it.each([
    ['GET', '/health'],
    ['GET', '/agents'],
    ['POST', '/agents/simple-agent/execute'],
    ['POST', '/agents/simple-agent/stream'],
    ['GET', '/executions/exec-nothing'],
    ['DELETE', '/executions/exec-nothing']
  ] as const)('runs before %s %s', async (method, url) => {
    await app().inject({
      method,
      url,
      headers: { 'content-type': 'application/json' },
      payload:
        method === 'POST'
          ? JSON.stringify({ input: { prompt: SIMPLE } })
          : undefined
    })

    expect(seenByAuth).toHaveBeenCalledWith(url)
  })

  it('lets every request through untouched', async () => {
    const response = await app().inject('/health')

    expect(response.statusCode).toBe(200)
  })
})

describe('what no response carries', () => {
  it.each(['/health', '/agents'])('sends no x-powered-by on %s', async path => {
    const response = await app().inject(path)

    expect(response.headers['x-powered-by']).toBeUndefined()
  })
})

describe('the adapter source', () => {
  function sources(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const path = join(directory, entry.name)

      if (entry.isDirectory()) {
        return sources(path)
      }

      return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
        ? [path]
        : []
    })
  }

  it('uses no Bun-only API', () => {
    const files = sources(join(__dirname, '..'))

    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(
        /\bBun\.\w|\bglobalThis\.Bun\b|\btypeof Bun\b|['"]bun(:\w+)?['"]/
      )
    }
  })
})
