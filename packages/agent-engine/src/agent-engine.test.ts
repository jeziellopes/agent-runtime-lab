import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  AgentAlreadyRegisteredError,
  AgentError,
  AgentNotFoundError,
  GraphInvalidError,
  ToolError,
  ValidationError
} from '@arl/contracts'
import { describe, expect, it } from 'vitest'

import { DefaultAgentEngine } from './agent-engine.js'

import type {
  AgentDefinition,
  AgentNode,
  ExecutionRequest,
  LLMProvider,
  MemoryStore,
  NodeResult,
  ToolRegistry
} from '@arl/contracts'
import type { RuntimeEvent } from '@arl/events'
import type { GraphDeps } from '@arl/graph-runtime'

const DEPS: GraphDeps = {
  provider: {} as LLMProvider,
  tools: {} as ToolRegistry,
  memory: {} as MemoryStore,
  signal: new AbortController().signal
}

function node(
  id: string,
  body: () => NodeResult = () => ({ stateUpdate: {} })
): AgentNode {
  return { id, execute: () => Promise.resolve(body()) }
}

function definition(
  id: string,
  nodes: AgentNode[] = [node('only', () => ({ stateUpdate: { output: id } }))],
  edges: AgentDefinition['graph']['edges'] = []
): AgentDefinition {
  return {
    id,
    name: id,
    description: `the ${id} agent`,
    graph: { entry: nodes[0]?.id ?? 'only', nodes, edges },
    tools: []
  }
}

function request(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return { agentId: 'simple-agent', input: { prompt: 'hello' }, ...overrides }
}

function engineWith(...definitions: AgentDefinition[]): DefaultAgentEngine {
  const engine = new DefaultAgentEngine()

  for (const agent of definitions) {
    engine.register(agent)
  }

  return engine
}

async function eventsOf(
  iterable: AsyncIterable<RuntimeEvent>
): Promise<RuntimeEvent[]> {
  const events: RuntimeEvent[] = []

  for await (const event of iterable) {
    events.push(event)
  }

  return events
}

describe('registering', () => {
  it('refuses an id already registered and keeps the first definition', () => {
    const first = definition('simple-agent')
    const engine = engineWith(first)

    expect(() => {
      engine.register(definition('simple-agent'))
    }).toThrow(AgentAlreadyRegisteredError)
    expect(engine.agents()).toEqual([first])
  })

  it('refuses an empty id', () => {
    expect(() => {
      engineWith({ ...definition('x'), id: '' })
    }).toThrow(AgentError)
  })

  it('refuses a graph that does not compile, and registers nothing', () => {
    const engine = new DefaultAgentEngine()

    expect(() => {
      engine.register(
        definition('broken', [node('a')], [{ from: 'a', to: 'ghost' }])
      )
    }).toThrow(GraphInvalidError)
    expect(engine.agents()).toEqual([])
  })

  it('lists by id, whatever order they arrived in', () => {
    const engine = engineWith(
      definition('tool-agent'),
      definition('multi-step-agent'),
      definition('simple-agent')
    )

    expect(engine.agents().map(agent => agent.id)).toEqual([
      'multi-step-agent',
      'simple-agent',
      'tool-agent'
    ])
  })

  it('lists nothing before anything is registered', () => {
    expect(new DefaultAgentEngine().agents()).toEqual([])
  })
})

describe('resolving a request', () => {
  it('returns the definition it was registered with', () => {
    const simple = definition('simple-agent')

    expect(engineWith(simple).resolve(request())).toBe(simple)
  })

  it('refuses an agentId nobody registered', () => {
    expect(() => new DefaultAgentEngine().resolve(request())).toThrow(
      AgentNotFoundError
    )
  })

  it.each([
    ['an absent prompt', {}],
    ['a numeric prompt', { prompt: 42 }],
    ['an empty prompt', { prompt: '' }],
    ['a null input', null],
    ['a string input', 'hello']
  ])('refuses %s', (_case, input) => {
    const engine = engineWith(definition('simple-agent'))

    expect(() => engine.resolve(request({ input }))).toThrow(ValidationError)
    expect(() => engine.createContext(request({ input }), 'e1')).toThrow(
      ValidationError
    )
  })

  it('refuses an unknown agent from createContext too', () => {
    expect(() =>
      new DefaultAgentEngine().createContext(request(), 'e1')
    ).toThrow(AgentNotFoundError)
  })
})

describe('the context it builds', () => {
  const engine = engineWith(definition('simple-agent'))

  it('carries the execution id, the agent and the prompt', () => {
    const context = engine.createContext(request(), 'exec-1')

    expect(context.executionId).toBe('exec-1')
    expect(context.agentId).toBe('simple-agent')
    expect(context.state).toEqual({ input: 'hello' })
  })

  it('omits sessionId entirely when the request carries none', () => {
    expect(engine.createContext(request(), 'e1')).not.toHaveProperty(
      'sessionId'
    )
  })

  it('carries sessionId through unchanged when it is there', () => {
    expect(
      engine.createContext(request({ sessionId: 's1' }), 'e1').sessionId
    ).toBe('s1')
  })

  it('defaults metadata to an empty object', () => {
    expect(engine.createContext(request(), 'e1').metadata).toEqual({})
  })

  it('carries metadata through when it is there', () => {
    expect(
      engine.createContext(request({ metadata: { a: 1 } }), 'e1').metadata
    ).toEqual({ a: 1 })
  })

  it('is data, holding no function anywhere on it', () => {
    const context = engine.createContext(request(), 'e1')

    expect(
      Object.values(context).some(value => typeof value === 'function')
    ).toBe(false)
  })
})

describe('driving the graph', () => {
  it('resolves run to the state the graph left', async () => {
    const engine = engineWith(definition('simple-agent'))
    const state = await engine.run(engine.createContext(request(), 'e1'), DEPS)

    expect(state['output']).toBe('simple-agent')
  })

  it('forwards the graph events unchanged', async () => {
    const engine = engineWith(
      definition(
        'simple-agent',
        [node('a'), node('b')],
        [{ from: 'a', to: 'b' }]
      )
    )
    const events = await eventsOf(
      engine.stream(engine.createContext(request(), 'e1'), DEPS)
    )

    expect(events.map(event => event.type)).toEqual([
      'node.started',
      'node.completed',
      'node.started',
      'node.completed'
    ])
  })

  it('emits no execution event, which belongs a layer up', async () => {
    const engine = engineWith(definition('simple-agent'))
    const events = await eventsOf(
      engine.stream(engine.createContext(request(), 'e1'), DEPS)
    )

    expect(events.some(event => event.type.startsWith('execution.'))).toBe(
      false
    )
  })

  it('propagates a node error without reclassifying it', async () => {
    const engine = engineWith(
      definition('simple-agent', [
        node('only', () => {
          throw new ToolError('the tool refused')
        })
      ])
    )

    await expect(
      engine.run(engine.createContext(request(), 'e1'), DEPS)
    ).rejects.toMatchObject({ category: 'tool', code: 'tool_error' })
  })

  it.each(['run', 'stream'] as const)(
    'refuses %s for an agent that was never registered',
    method => {
      const engine = new DefaultAgentEngine()
      const context = {
        executionId: 'e1',
        agentId: 'ghost',
        state: {},
        metadata: {}
      }

      expect(() => engine[method](context, DEPS)).toThrow(AgentNotFoundError)
    }
  )

  it('keeps two agents apart when they run at once', async () => {
    const engine = engineWith(
      definition('one', [node('a')]),
      definition('two', [node('b')])
    )
    const [first, second] = await Promise.all([
      eventsOf(
        engine.stream(
          engine.createContext(request({ agentId: 'one' }), 'first'),
          DEPS
        )
      ),
      eventsOf(
        engine.stream(
          engine.createContext(request({ agentId: 'two' }), 'second'),
          DEPS
        )
      )
    ])

    expect(first?.every(event => event.executionId === 'first')).toBe(true)
    expect(second?.every(event => event.executionId === 'second')).toBe(true)
  })
})

describe('what the package is allowed to reach', () => {
  it('declares no framework dependency', () => {
    const { dependencies } = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
    ) as { dependencies: Record<string, string> }

    expect(Object.keys(dependencies).sort()).toEqual([
      '@arl/contracts',
      '@arl/events',
      '@arl/graph-runtime'
    ])
  })

  it.each(['agent-engine.ts', 'agent-registry.ts'])(
    'imports no framework in %s',
    file => {
      expect(readFileSync(join(__dirname, file), 'utf8')).not.toMatch(
        /from '(@nestjs\/|hono|express|fastify)/
      )
    }
  )
})
