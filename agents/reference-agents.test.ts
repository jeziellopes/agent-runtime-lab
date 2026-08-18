import { DefaultAgentEngine } from '@arl/agent-engine'
import { ExecutionStatus } from '@arl/contracts'
import { ReplayLLMProvider } from '@arl/llm'
import { InMemoryStore } from '@arl/memory'
import { AgentRuntimeCore } from '@arl/runtime-core'
import { CalculatorTool, InMemoryToolRegistry } from '@arl/tools'
import { describe, expect, it } from 'vitest'

import { REFERENCE_AGENTS } from './index.js'
import {
  DIRECT_PROMPT,
  TOOL_PROMPT,
  SYSTEM_PROMPT as TOOL_SYSTEM_PROMPT
} from './tool-agent/prompts.js'
import {
  EXAMPLE_PROMPT as MULTI_STEP_PROMPT,
  STEPS,
  SYSTEM_PROMPT as MULTI_STEP_SYSTEM_PROMPT,
  USER_PROMPT_TEMPLATE as MULTI_STEP_TEMPLATE
} from './multi-step-agent/prompts.js'
import {
  EXAMPLE_PROMPT as SIMPLE_PROMPT,
  SYSTEM_PROMPT as SIMPLE_SYSTEM_PROMPT,
  USER_PROMPT_TEMPLATE as SIMPLE_TEMPLATE
} from './simple-agent/prompts.js'

import type {
  ExecutionRequest,
  RuntimeConfig,
  Tool,
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

/**
 * What a cell's composition root does, minus the framework: the same three
 * definitions, the replay set the fixtures live in, and one registry holding
 * every tool any of them declared.
 */
function runtime(registry?: ToolRegistry): AgentRuntimeCore {
  const engine = new DefaultAgentEngine(undefined, CONFIG.maxIterations)
  const tools = registry ?? new InMemoryToolRegistry()

  for (const agent of REFERENCE_AGENTS) {
    engine.register(agent)

    if (registry === undefined) {
      for (const tool of agent.tools) {
        tools.register(tool)
      }
    }
  }

  return new AgentRuntimeCore(CONFIG, {
    engine,
    provider: new ReplayLLMProvider('contract'),
    tools,
    memory: new InMemoryStore()
  })
}

/** Lists what it cannot resolve, which is the composition-root defect. */
function registryOf(tool: Tool, resolvable = true): ToolRegistry {
  return {
    register: () => undefined,
    get: () => (resolvable ? tool : null),
    list: () => [tool]
  }
}

function request(agentId: string, prompt: string): ExecutionRequest {
  return { agentId, input: { prompt } }
}

function dataOf(event: RuntimeEvent): Record<string, unknown> {
  return 'data' in event ? (event.data as Record<string, unknown>) : {}
}

/** `node.started(llm)`, `llm.token`, `node.completed(decision:needsTool)`. */
function shapeOf(events: RuntimeEvent[]): string[] {
  return events.map(event => {
    const { node, branch, tool } = dataOf(event) as {
      node?: string
      branch?: string
      tool?: string
    }
    const subject = node ?? tool

    if (subject === undefined) {
      return event.type
    }

    return `${event.type}(${subject}${branch === undefined ? '' : `:${branch}`})`
  })
}

async function streamOf(
  core: AgentRuntimeCore,
  agentId: string,
  prompt: string
): Promise<RuntimeEvent[]> {
  const events: RuntimeEvent[] = []

  for await (const event of core.stream(request(agentId, prompt))) {
    events.push(event)
  }

  return events
}

function tokensOf(events: RuntimeEvent[]): string[] {
  return events
    .filter(event => event.type === 'llm.token')
    .map(event => String(dataOf(event)['token']))
}

describe('what the three agents are', () => {
  it('exports exactly the three ids the matrix runs', async () => {
    await expect(runtime().listAgents()).resolves.toMatchObject([
      { id: 'multi-step-agent' },
      { id: 'simple-agent' },
      { id: 'tool-agent' }
    ])
  })

  it.each(REFERENCE_AGENTS.map(agent => [agent.id, agent] as const))(
    '%s reaches every node in its graph from its entry',
    (_id, agent) => {
      const ids = new Set(agent.graph.nodes.map(node => node.id))
      const reached = new Set([agent.graph.entry])

      for (const edge of agent.graph.edges) {
        expect(ids.has(edge.from)).toBe(true)
        expect(ids.has(edge.to)).toBe(true)
        reached.add(edge.to)
      }

      expect(agent.graph.nodes.length).toBeGreaterThan(0)
      expect(reached).toEqual(ids)
    }
  )

  it.each([
    ['simple-agent', []],
    ['tool-agent', ['calculator', 'search']],
    ['multi-step-agent', []]
  ])('%s registers %s', (id, names) => {
    const agent = REFERENCE_AGENTS.find(candidate => candidate.id === id)

    expect(agent?.tools.map(tool => tool.name)).toEqual(names)
  })
})

describe('the prompt constants', () => {
  it.each([
    ['simple system', SIMPLE_SYSTEM_PROMPT],
    ['simple template', SIMPLE_TEMPLATE],
    ['tool system', TOOL_SYSTEM_PROMPT],
    ['multi-step system', MULTI_STEP_SYSTEM_PROMPT],
    ['multi-step template', MULTI_STEP_TEMPLATE],
    ...Object.entries(STEPS)
  ])('%s is a non-empty string', (_name, value) => {
    expect(typeof value).toBe('string')
    expect(value.length).toBeGreaterThan(0)
  })

  it.each([
    [SIMPLE_PROMPT, 'Explain what an API gateway is.'],
    [TOOL_PROMPT, 'Calculate 125 * 50'],
    [DIRECT_PROMPT, 'What does API stand for?'],
    [MULTI_STEP_PROMPT, 'Compare REST and GraphQL for a public API.']
  ])('pins %s exactly', (constant, pinned) => {
    expect(constant).toBe(pinned)
  })
})

describe('simple-agent', () => {
  it('emits one model call bracketed by its two nodes', async () => {
    const events = await streamOf(runtime(), 'simple-agent', SIMPLE_PROMPT)

    expect(shapeOf(events)).toEqual([
      'execution.created',
      'execution.started',
      'node.started(llm)',
      'llm.started(llm)',
      ...Array.from({ length: 8 }, () => 'llm.token'),
      'llm.completed(llm)',
      'node.completed(llm)',
      'node.started(response)',
      'node.completed(response)',
      'execution.completed'
    ])
  })

  it('answers with the tokens the fixture streamed', async () => {
    const result = await runtime().execute(
      request('simple-agent', SIMPLE_PROMPT)
    )

    expect(result).toMatchObject({
      status: ExecutionStatus.COMPLETED,
      output: { text: 'An API gateway routes requests to backend services.' }
    })
  })

  it('reports the usage the fixture declares', async () => {
    const events = await streamOf(runtime(), 'simple-agent', SIMPLE_PROMPT)
    const completed = events.find(event => event.type === 'llm.completed')

    expect(dataOf(completed as RuntimeEvent)['usage']).toEqual({
      inputTokens: 6,
      outputTokens: 8,
      totalTokens: 14
    })
  })
})

describe('tool-agent', () => {
  it('takes the tool branch and calls the model twice', async () => {
    const events = await streamOf(runtime(), 'tool-agent', TOOL_PROMPT)

    expect(shapeOf(events)).toEqual([
      'execution.created',
      'execution.started',
      'node.started(planner)',
      'llm.started(planner)',
      ...Array.from({ length: 6 }, () => 'llm.token'),
      'llm.completed(planner)',
      'node.completed(planner)',
      'node.started(decision)',
      'node.completed(decision:needsTool)',
      'node.started(tool)',
      'tool.started(calculator)',
      'tool.completed(calculator)',
      'node.completed(tool)',
      'node.started(response)',
      'llm.started(response)',
      ...Array.from({ length: 6 }, () => 'llm.token'),
      'llm.completed(response)',
      'node.completed(response)',
      'execution.completed'
    ])
  })

  it('passes the expression to the calculator and reports 6250', async () => {
    const events = await streamOf(runtime(), 'tool-agent', TOOL_PROMPT)
    const started = events.find(event => event.type === 'tool.started')
    const completed = events.find(event => event.type === 'tool.completed')

    expect(dataOf(started as RuntimeEvent)['input']).toEqual({
      expression: '125 * 50'
    })
    expect(dataOf(completed as RuntimeEvent)['output']).toBe(6250)
  })

  it('takes the direct branch with no tool and one model call', async () => {
    const events = await streamOf(runtime(), 'tool-agent', DIRECT_PROMPT)

    expect(shapeOf(events)).toEqual([
      'execution.created',
      'execution.started',
      'node.started(planner)',
      'llm.started(planner)',
      ...Array.from({ length: 6 }, () => 'llm.token'),
      'llm.completed(planner)',
      'node.completed(planner)',
      'node.started(decision)',
      'node.completed(decision:answersDirectly)',
      'node.started(response)',
      'node.completed(response)',
      'execution.completed'
    ])
  })

  it('answers the direct branch with the planner text', async () => {
    const result = await runtime().execute(request('tool-agent', DIRECT_PROMPT))

    expect(result.output).toEqual({
      text: 'API means application programming interface here.'
    })
  })

  it('exits WAITING and fails when the calculator rejects', async () => {
    const core = runtime()

    await expect(
      core.execute(request('tool-agent', 'Calculate 1 / bananas'))
    ).rejects.toMatchObject({ code: 'tool_error' })

    const events = await streamOf(core, 'tool-agent', 'Calculate 1 / bananas')

    /* No `node.completed(tool)`: the node rethrows, so the graph stops there.
       The WAITING pair still closes, which is what this asserts. */
    expect(shapeOf(events).slice(-4)).toEqual([
      'node.started(tool)',
      'tool.started(calculator)',
      'tool.completed(calculator)',
      'execution.failed'
    ])
    expect(
      dataOf(
        events.find(event => event.type === 'tool.completed') as RuntimeEvent
      )['output']
    ).toMatchObject({ error: 'tool_error' })
  })
})

describe('what the tool node does with a registry it cannot use', () => {
  it('refuses a tool the registry lists but cannot resolve', async () => {
    const core = runtime(registryOf(new CalculatorTool(), false))

    await expect(
      core.execute(request('tool-agent', TOOL_PROMPT))
    ).rejects.toMatchObject({
      code: 'tool_error',
      message: 'no tool named calculator is registered'
    })
  })

  it('still closes WAITING when a tool throws outside the contract', async () => {
    const core = runtime(
      registryOf({
        name: 'calculator',
        description: 'throws something that is not a RuntimeError',
        execute: () => Promise.reject(new Error('boom'))
      })
    )
    const events = await streamOf(core, 'tool-agent', TOOL_PROMPT)
    const completed = events.find(event => event.type === 'tool.completed')

    expect(dataOf(completed as RuntimeEvent)['output']).toEqual({
      error: 'agent_error',
      detail: 'Error: boom'
    })
    expect(events.at(-1)?.type).toBe('execution.failed')
  })
})

describe('multi-step-agent', () => {
  it('calls the model once per reasoning node', async () => {
    const events = await streamOf(
      runtime(),
      'multi-step-agent',
      MULTI_STEP_PROMPT
    )

    expect(shapeOf(events)).toEqual([
      'execution.created',
      'execution.started',
      'node.started(planner)',
      'llm.started(planner)',
      ...Array.from({ length: 6 }, () => 'llm.token'),
      'llm.completed(planner)',
      'node.completed(planner)',
      'node.started(research)',
      'llm.started(research)',
      ...Array.from({ length: 7 }, () => 'llm.token'),
      'llm.completed(research)',
      'node.completed(research)',
      'node.started(analysis)',
      'llm.started(analysis)',
      ...Array.from({ length: 7 }, () => 'llm.token'),
      'llm.completed(analysis)',
      'node.completed(analysis)',
      'node.started(response)',
      'node.completed(response)',
      'execution.completed'
    ])
    expect(tokensOf(events)).toHaveLength(20)
  })

  it('answers with the last call, not the first', async () => {
    const result = await runtime().execute(
      request('multi-step-agent', MULTI_STEP_PROMPT)
    )

    expect(result.output).toEqual({
      text: 'GraphQL trades caching simplicity for query flexibility.'
    })
  })

  it('gives each node its own step in the user message', () => {
    expect(
      MULTI_STEP_TEMPLATE.replace('{step}', STEPS.research).replace(
        '{prompt}',
        MULTI_STEP_PROMPT
      )
    ).toBe(`${STEPS.research}\n\n${MULTI_STEP_PROMPT}`)
  })
})

describe('what holds for all three', () => {
  it.each([
    ['simple-agent', SIMPLE_PROMPT],
    ['tool-agent', TOOL_PROMPT],
    ['multi-step-agent', MULTI_STEP_PROMPT]
  ])('%s ends once and emits nothing after it', async (agentId, prompt) => {
    const events = await streamOf(runtime(), agentId, prompt)
    const terminal = events.filter(event =>
      [
        'execution.completed',
        'execution.failed',
        'execution.cancelled'
      ].includes(event.type)
    )

    expect(terminal).toHaveLength(1)
    expect(events.at(-1)).toBe(terminal[0])
  })

  it.each([
    ['simple-agent', SIMPLE_PROMPT],
    ['tool-agent', TOOL_PROMPT],
    ['multi-step-agent', MULTI_STEP_PROMPT]
  ])('%s runs twice to the same bytes', async (agentId, prompt) => {
    const first = await streamOf(runtime(), agentId, prompt)
    const second = await streamOf(runtime(), agentId, prompt)

    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })

  it('emits nothing for an unknown agent', async () => {
    const core = runtime()

    expect(() => core.stream(request('ghost', SIMPLE_PROMPT))).toThrow(/ghost/)
  })

  it.each([[''], [42], [undefined]])(
    'emits nothing for an input whose prompt is %s',
    prompt => {
      const core = runtime()

      expect(() =>
        core.stream({
          agentId: 'simple-agent',
          input: { prompt } as unknown as { prompt: string }
        })
      ).toThrow(/prompt/)
    }
  )
})
