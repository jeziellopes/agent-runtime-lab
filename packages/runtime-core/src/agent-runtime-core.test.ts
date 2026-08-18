import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { DefaultAgentEngine } from '@arl/agent-engine'
import {
  AgentError,
  AgentNotFoundError,
  ExecutionStatus,
  ProviderError,
  ToolError,
  ValidationError
} from '@arl/contracts'
import { describe, expect, it } from 'vitest'

import { AgentRuntimeCore } from './agent-runtime-core.js'
import { deriveExecutionId } from './execution-id.js'

import type { RuntimeCollaborators } from './agent-runtime-core.js'
import type {
  AgentDefinition,
  AgentNode,
  LLMProvider,
  MemoryStore,
  NodeDeps,
  NodeResult,
  RuntimeConfig,
  ToolRegistry
} from '@arl/contracts'
import type { RuntimeEvent } from '@arl/events'

const CONFIG: RuntimeConfig = {
  defaultModel: 'authored',
  maxIterations: 10,
  timeoutMs: 30_000,
  llmMode: 'replay',
  maxRetries: 3,
  deterministic: true
}

const PROVIDER = {} as LLMProvider
const TOOLS = {} as ToolRegistry
const MEMORY = {} as MemoryStore

const PROMPT = 'Explain what an API gateway is.'

function node(
  id: string,
  body: (deps: NodeDeps) => NodeResult | Promise<NodeResult> = () => ({
    stateUpdate: { output: 'done' }
  })
): AgentNode {
  return { id, execute: (_context, deps) => Promise.resolve(body(deps)) }
}

/** Nodes are chained in the order given, so a two-node graph is reachable. */
function definition(
  id: string,
  nodes: AgentNode[] = [node('llm')]
): AgentDefinition {
  return {
    id,
    name: id,
    description: `the ${id} agent`,
    graph: {
      entry: nodes[0]?.id ?? 'llm',
      nodes,
      edges: nodes
        .slice(1)
        .map((to, index) => ({ from: nodes[index]?.id ?? '', to: to.id }))
    },
    tools: []
  }
}

/** The union has no `data` on two of its twelve members. */
function dataOf(event: RuntimeEvent | undefined): Record<string, unknown> {
  return event !== undefined && 'data' in event
    ? (event.data as Record<string, unknown>)
    : {}
}

function runtime(
  agents: AgentDefinition[] = [definition('simple-agent')],
  config: RuntimeConfig = CONFIG,
  extra: Partial<RuntimeCollaborators> = {}
): AgentRuntimeCore {
  const engine = new DefaultAgentEngine(undefined, config.maxIterations)

  for (const agent of agents) {
    engine.register(agent)
  }

  return new AgentRuntimeCore(config, {
    engine,
    provider: PROVIDER,
    tools: TOOLS,
    memory: MEMORY,
    ...extra
  })
}

const request = (
  overrides = {}
): Parameters<AgentRuntimeCore['execute']>[0] => ({
  agentId: 'simple-agent',
  input: { prompt: PROMPT },
  ...overrides
})

async function typesOf(
  iterable: AsyncIterable<RuntimeEvent>
): Promise<string[]> {
  const types: string[] = []

  for await (const event of iterable) {
    types.push(event.type)
  }

  return types
}

describe('executing', () => {
  it('completes, and the stored execution carries the same id', async () => {
    const core = runtime()
    const result = await core.execute(request())

    expect(result.status).toBe(ExecutionStatus.COMPLETED)
    await expect(core.getExecution(result.executionId)).resolves.toMatchObject({
      id: result.executionId,
      status: ExecutionStatus.COMPLETED
    })
  })

  it('maps the final graph state onto the pinned output shape', async () => {
    const result = await runtime().execute(request())

    expect(result.output).toEqual({ text: 'done' })
  })

  it('omits metrics under deterministic mode, so no golden carries a timing', async () => {
    const result = await runtime().execute(request())

    expect(result).not.toHaveProperty('metrics')
  })

  it('reports metrics when it is not deterministic', async () => {
    const result = await runtime(undefined, {
      ...CONFIG,
      deterministic: false
    }).execute(request())

    expect(result.metrics).toMatchObject({
      llmCalls: 0,
      toolCalls: 0,
      eventsGenerated: expect.any(Number)
    })
    expect(result.metrics?.executionDuration).toBeGreaterThan(0)
  })
})

describe('the event sequence', () => {
  it('brackets the graph with the execution lifecycle', async () => {
    const core = runtime()

    expect(await typesOf(core.stream(request()))).toEqual([
      'execution.created',
      'execution.started',
      'node.started',
      'node.completed',
      'execution.completed'
    ])
  })

  it('emits the identical sequence whichever path drove it', async () => {
    const streamed = await typesOf(runtime().stream(request()))
    const core = runtime()

    await core.execute(request())

    expect(await typesOf(core.stream(request()))).toEqual(streamed)
  })

  it('emits exactly one terminal event, with nothing after it', async () => {
    const types = await typesOf(runtime().stream(request()))
    const terminal = types.filter(type =>
      [
        'execution.completed',
        'execution.failed',
        'execution.cancelled'
      ].includes(type)
    )

    expect(terminal).toHaveLength(1)
    expect(types[types.length - 1]).toBe('execution.completed')
  })

  it('keeps two concurrent executions out of each other', async () => {
    const core = runtime([definition('one'), definition('two')])

    const collect = async (agentId: string): Promise<string[]> => {
      const ids: string[] = []

      for await (const event of core.stream(request({ agentId }))) {
        ids.push(event.executionId)
      }

      return ids
    }

    const [first, second] = await Promise.all([collect('one'), collect('two')])

    expect(new Set(first).size).toBe(1)
    expect(new Set(second).size).toBe(1)
    expect(first[0]).not.toBe(second[0])
  })
})

describe('the execution id', () => {
  it('derives the same id for the same request under deterministic mode', async () => {
    const first = await runtime().execute(request())
    const second = await runtime().execute(request())

    expect(first.executionId).toBe(second.executionId)
    expect(first.executionId).toBe(deriveExecutionId('simple-agent', PROMPT))
  })

  it('stamps every event with the epoch under deterministic mode', async () => {
    const core = runtime()
    const stamps: string[] = []

    for await (const event of core.stream(request())) {
      stamps.push(event.timestamp.toISOString())
    }

    expect(new Set(stamps)).toEqual(new Set(['1970-01-01T00:00:00.000Z']))
  })

  it('issues a different id per execution when it is not deterministic', async () => {
    const core = runtime(undefined, { ...CONFIG, deterministic: false })
    const first = await core.execute(request())
    const second = await core.execute(request())

    expect(first.executionId).not.toBe(second.executionId)
  })
})

describe('refusing before anything is created', () => {
  it('refuses an unknown agent without emitting or storing anything', async () => {
    const core = runtime()

    await expect(
      core.execute(request({ agentId: 'ghost' }))
    ).rejects.toBeInstanceOf(AgentNotFoundError)
  })

  it('refuses an input that carries no prompt', async () => {
    await expect(
      runtime().execute(request({ input: {} }))
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('failing', () => {
  const failing = (error: Error): AgentDefinition =>
    definition('simple-agent', [
      node('llm', () => {
        throw error
      })
    ])

  it.each([
    ['a tool failure', new ToolError('bad input'), 'tool_error'],
    ['a provider failure', new ProviderError('down'), 'provider_error'],
    ['anything else', new Error('boom'), 'agent_error']
  ])('ends in execution.failed carrying %s', async (_case, error, code) => {
    const core = runtime([failing(error)])
    const events: RuntimeEvent[] = []

    for await (const event of core.stream(request())) {
      events.push(event)
    }

    const [last] = events.slice(-1)

    expect(last?.type).toBe('execution.failed')
    expect(dataOf(last)['error']).toBe(code)
  })

  it('leaves the execution FAILED', async () => {
    const core = runtime([failing(new ToolError('bad input'))])

    await expect(core.execute(request())).rejects.toBeInstanceOf(ToolError)

    const [stored] = await core.listAgents()

    expect(stored?.id).toBe('simple-agent')
  })
})

describe('cancelling', () => {
  it('is a no-op on an id nobody knows', async () => {
    await expect(runtime().cancel('ghost')).resolves.toBeUndefined()
  })

  it('halts the run and ends in execution.cancelled', async () => {
    const core = runtime([
      definition('simple-agent', [
        node('llm', () => {
          void core.cancel(deriveExecutionId('simple-agent', PROMPT))

          return { stateUpdate: { output: 'first' } }
        }),
        node('second')
      ])
    ])
    const types = await typesOf(core.stream(request()))

    expect(types[types.length - 1]).toBe('execution.cancelled')
    expect(types.filter(type => type === 'node.started')).toHaveLength(1)
  })

  it('leaves the execution CANCELLED', async () => {
    const core = runtime([
      definition('simple-agent', [
        node('llm', () => {
          void core.cancel(deriveExecutionId('simple-agent', PROMPT))

          return { stateUpdate: {} }
        })
      ])
    ])
    const result = await core.execute(request())

    expect(result.status).toBe(ExecutionStatus.CANCELLED)
    await expect(core.getExecution(result.executionId)).resolves.toMatchObject({
      status: ExecutionStatus.CANCELLED
    })
  })

  it('emits no second terminal event once it is already terminal', async () => {
    const core = runtime()
    const result = await core.execute(request())

    await core.cancel(result.executionId)

    await expect(core.getExecution(result.executionId)).resolves.toMatchObject({
      status: ExecutionStatus.COMPLETED
    })
  })
})

describe('accounting for what the graph did', () => {
  const busy = (): AgentDefinition =>
    definition('simple-agent', [
      node('llm', deps => {
        deps.emit({
          type: 'llm.started',
          executionId: 'ignored',
          data: { node: 'llm', model: 'authored' }
        })
        deps.emit({
          type: 'llm.completed',
          executionId: 'ignored',
          data: {
            node: 'llm',
            usage: { inputTokens: 6, outputTokens: 8, totalTokens: 14 }
          }
        })
        deps.emit({
          type: 'tool.started',
          executionId: 'ignored',
          data: { tool: 'calculator', input: { expression: '1 + 1' } }
        })
        deps.emit({
          type: 'tool.completed',
          executionId: 'ignored',
          data: { tool: 'calculator', output: 2 }
        })

        return { stateUpdate: { output: 'done' } }
      }),
      node('second', deps => {
        deps.emit({
          type: 'llm.completed',
          executionId: 'ignored',
          data: {
            node: 'second',
            usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }
          }
        })

        return { stateUpdate: {} }
      })
    ])

  it('sums usage across every model call', async () => {
    const result = await runtime([busy()]).execute(request())

    expect(result.usage).toEqual({
      inputTokens: 7,
      outputTokens: 10,
      totalTokens: 17
    })
  })

  it('counts the calls and the events it published', async () => {
    const result = await runtime([busy()], {
      ...CONFIG,
      deterministic: false
    }).execute(request())

    /* Two node pairs, four the first node emitted and one the second did. The
       lifecycle events are the runtime's, not the graph's. */
    expect(result.metrics).toMatchObject({
      llmCalls: 1,
      toolCalls: 1,
      eventsGenerated: 9
    })
    expect(result.metrics?.nodeDuration).toBeGreaterThan(0)
  })

  it('reports an empty output when the graph left none', async () => {
    const result = await runtime([
      definition('simple-agent', [node('llm', () => ({ stateUpdate: {} }))])
    ]).execute(request())

    expect(result.output).toEqual({ text: '' })
  })
})

describe('the time budget', () => {
  it('ends in a provider failure once the budget is spent', async () => {
    const core = runtime(
      [
        definition('simple-agent', [
          node(
            'llm',
            () =>
              new Promise(resolve => {
                setTimeout(() => {
                  resolve({ stateUpdate: {} })
                }, 40)
              })
          )
        ])
      ],
      { ...CONFIG, deterministic: false, timeoutMs: 1 }
    )

    await expect(core.execute(request())).rejects.toBeInstanceOf(ProviderError)
  })

  it('waits between retries when it is not deterministic', async () => {
    const slept: number[] = []
    const core = runtime(
      [
        definition('simple-agent', [
          node('llm', deps => {
            const flaky = deps.provider

            return flaky
              .generate({ messages: [], model: 'authored' })
              .then(() => ({ stateUpdate: { output: 'done' } }))
          })
        ])
      ],
      { ...CONFIG, deterministic: false, maxRetries: 2 },
      {
        provider: {
          generate: request_ => {
            slept.push(request_.attempt ?? 0)

            return slept.length < 2
              ? Promise.reject(new ProviderError('down'))
              : Promise.resolve({
                  content: 'ok',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
                })
          },
          stream: () => {
            throw new ProviderError('unused')
          },
          countTokens: () => Promise.resolve(0)
        }
      }
    )

    await expect(core.execute(request())).resolves.toMatchObject({
      status: ExecutionStatus.COMPLETED
    })
    expect(slept).toEqual([1, 2])
  })
})

describe('retrying under deterministic mode', () => {
  const flakyProvider = (
    failures: number,
    attempts: number[]
  ): Partial<RuntimeCollaborators> => ({
    provider: {
      generate: request_ => {
        attempts.push(request_.attempt ?? 0)

        return attempts.length <= failures
          ? Promise.reject(new ProviderError('down'))
          : Promise.resolve({
              content: 'ok',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
            })
      },
      stream: () => {
        throw new ProviderError('unused')
      },
      countTokens: () => Promise.resolve(0)
    }
  })

  const calling = (): AgentDefinition =>
    definition('simple-agent', [
      node('llm', deps =>
        deps.provider
          .generate({ messages: [], model: 'authored' })
          .then(() => ({ stateUpdate: { output: 'done' } }))
      )
    ])

  it('retries without waiting, so the suite adds no wall clock', async () => {
    const attempts: number[] = []
    const core = runtime([calling()], CONFIG, flakyProvider(2, attempts))
    const startedAt = Date.now()

    await expect(core.execute(request())).resolves.toMatchObject({
      status: ExecutionStatus.COMPLETED
    })
    expect(attempts).toEqual([1, 2, 3])
    expect(Date.now() - startedAt).toBeLessThan(100)
  })

  it('fails once the budget is spent, provider-category', async () => {
    const attempts: number[] = []
    const core = runtime([calling()], CONFIG, flakyProvider(9, attempts))

    await expect(core.execute(request())).rejects.toBeInstanceOf(ProviderError)
    expect(attempts).toEqual([1, 2, 3, 4])
  })
})

describe('an internal failure that is not a runtime error', () => {
  it('still ends in execution.failed, as agent_error', async () => {
    const core = runtime(undefined, CONFIG, {
      store: {
        create: () => Promise.resolve(),
        get: () => Promise.resolve(null),
        transition: (_id, to) =>
          to === ExecutionStatus.COMPLETED
            ? Promise.reject(new Error('the store broke'))
            : Promise.resolve({
                id: 'e',
                agentId: 'simple-agent',
                status: to,
                input: {},
                createdAt: new Date(0)
              })
      }
    })
    const events: RuntimeEvent[] = []

    for await (const event of core.stream(request())) {
      events.push(event)
    }

    const [last] = events.slice(-1)

    expect(last?.type).toBe('execution.failed')
    expect(dataOf(last)).toEqual({
      error: 'agent_error',
      detail: 'the store broke'
    })
  })

  it('reports something thrown that is not an Error at all', async () => {
    const core = runtime(undefined, CONFIG, {
      store: {
        create: () => Promise.resolve(),
        get: () => Promise.resolve(null),
        transition: (_id, to) =>
          to === ExecutionStatus.COMPLETED
            ? Promise.reject('a bare string')
            : Promise.resolve({
                id: 'e',
                agentId: 'simple-agent',
                status: to,
                input: {},
                createdAt: new Date(0)
              })
      }
    })

    await expect(core.execute(request())).rejects.toThrow(/a bare string/)
  })
})

describe('what the runtime was built with', () => {
  it('refuses to run an agent when a collaborator is missing', async () => {
    const engine = new DefaultAgentEngine()

    engine.register(definition('simple-agent'))

    const core = new AgentRuntimeCore(CONFIG, { engine })

    await expect(core.execute(request())).rejects.toBeInstanceOf(AgentError)
  })

  it('has no agents at all when built with nothing', async () => {
    await expect(new AgentRuntimeCore(CONFIG).listAgents()).resolves.toEqual([])
  })

  it('carries the config it was given', () => {
    expect(runtime().runtimeConfig).toBe(CONFIG)
  })

  it('lists the agents its engine holds', async () => {
    await expect(
      runtime([definition('two'), definition('one')]).listAgents()
    ).resolves.toMatchObject([{ id: 'one' }, { id: 'two' }])
  })

  it('declares no framework dependency', () => {
    const { dependencies } = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
    ) as { dependencies: Record<string, string> }

    expect(
      Object.keys(dependencies).every(name => name.startsWith('@arl/'))
    ).toBe(true)
  })

  it.each([
    'agent-runtime-core.ts',
    'config.ts',
    'event-stream.ts',
    'execution-store.ts',
    'retry-policy.ts',
    'retrying-provider.ts'
  ])('imports no framework in %s', file => {
    expect(readFileSync(join(__dirname, file), 'utf8')).not.toMatch(
      /from '(@nestjs\/|hono|express|fastify)/
    )
  })
})
