import {
  AgentError,
  GraphInvalidError,
  GraphRouteInvalidError,
  MaxIterationsExceededError,
  ToolError
} from '@arl/contracts'
import { describe, expect, it } from 'vitest'

import { compileGraph } from './graph-runtime.js'

import type { GraphDeps } from './graph-runtime.js'
import type {
  AgentEdge,
  AgentGraph,
  AgentNode,
  ExecutionContext,
  LLMProvider,
  MemoryStore,
  NodeDeps,
  NodeResult,
  ToolRegistry
} from '@arl/contracts'
import type { EmittedEvent } from '@arl/events'

const DEPS: GraphDeps = {
  provider: {} as LLMProvider,
  model: 'authored',
  tools: {} as ToolRegistry,
  memory: {} as MemoryStore,
  signal: new AbortController().signal
}

function context(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    executionId: 'e1',
    agentId: 'test-agent',
    state: { input: 'x', output: '' },
    metadata: {},
    ...overrides
  }
}

function node(
  id: string,
  body: (
    deps: NodeDeps,
    context: ExecutionContext
  ) => NodeResult | Promise<NodeResult> = () => ({
    stateUpdate: {}
  })
): AgentNode {
  return {
    id,
    execute: (context, deps) => Promise.resolve(body(deps, context))
  }
}

function graphOf(
  nodes: AgentNode[],
  edges: AgentEdge[],
  entry?: string
): AgentGraph {
  return { entry: entry ?? nodes[0]?.id ?? 'a', nodes, edges }
}

async function eventsOf(
  iterable: AsyncIterable<EmittedEvent>
): Promise<EmittedEvent[]> {
  const events: EmittedEvent[] = []

  for await (const event of iterable) {
    events.push(event)
  }

  return events
}

/** The union has no `data` on two of its twelve members. */
function dataOf(event: EmittedEvent): Record<string, unknown> {
  return 'data' in event ? (event.data as Record<string, unknown>) : {}
}

function shapeOf(events: EmittedEvent[]): string[] {
  return events.map(event => {
    const { node, branch } = dataOf(event) as { node?: string; branch?: string }

    return `${event.type}(${node ?? ''}${branch === undefined ? '' : `:${branch}`})`
  })
}

const linear = (): AgentGraph =>
  graphOf([node('a'), node('b')], [{ from: 'a', to: 'b' }])

describe('compile-time validation', () => {
  it('refuses an entry that names no node', () => {
    expect(() =>
      compileGraph(graphOf([node('a')], [], 'missing'), { maxIterations: 5 })
    ).toThrow(GraphInvalidError)
  })

  it('refuses an empty node list', () => {
    expect(() =>
      compileGraph({ entry: 'a', nodes: [], edges: [] }, { maxIterations: 5 })
    ).toThrow(/at least one node/)
  })

  it('refuses two nodes sharing an id', () => {
    expect(() =>
      compileGraph(graphOf([node('a'), node('a')], []), { maxIterations: 5 })
    ).toThrow(/two nodes share the id a/)
  })

  it.each([
    ['from', { from: 'ghost', to: 'a' }],
    ['to', { from: 'a', to: 'ghost' }]
  ])('refuses an edge whose %s names no node', (_end, edge) => {
    expect(() =>
      compileGraph(graphOf([node('a')], [edge]), { maxIterations: 5 })
    ).toThrow(/names no node: ghost/)
  })

  it('refuses a node unreachable from the entry', () => {
    expect(() =>
      compileGraph(graphOf([node('a'), node('orphan')], []), {
        maxIterations: 5
      })
    ).toThrow(/orphan is unreachable from a/)
  })

  it('refuses a branch where one edge carries no condition', () => {
    expect(() =>
      compileGraph(
        graphOf(
          [node('a'), node('b'), node('c')],
          [
            { from: 'a', to: 'b', condition: 'left' },
            { from: 'a', to: 'c' }
          ]
        ),
        { maxIterations: 5 }
      )
    ).toThrow(/outgoing edges and one carries no condition/)
  })

  it('refuses a cycle with no edge leaving it', () => {
    expect(() =>
      compileGraph(
        graphOf(
          [node('a'), node('b')],
          [
            { from: 'a', to: 'b' },
            { from: 'b', to: 'a' }
          ]
        ),
        { maxIterations: 5 }
      )
    ).toThrow(/has no edge leaving it/)
  })

  it('accepts a diamond, where the join is reached twice from finished branches', () => {
    expect(() =>
      compileGraph(
        graphOf(
          [node('a'), node('b'), node('c'), node('join')],
          [
            { from: 'a', to: 'b', condition: 'left' },
            { from: 'a', to: 'c', condition: 'right' },
            { from: 'b', to: 'join' },
            { from: 'c', to: 'join' }
          ]
        ),
        { maxIterations: 5 }
      )
    ).not.toThrow()
  })

  it('refuses a node that loops only to itself', () => {
    expect(() =>
      compileGraph(graphOf([node('a')], [{ from: 'a', to: 'a' }]), {
        maxIterations: 5
      })
    ).toThrow(/has no edge leaving it/)
  })

  it('accepts a cycle that can be left', () => {
    expect(() =>
      compileGraph(
        graphOf(
          [node('a'), node('b'), node('done')],
          [
            { from: 'a', to: 'b' },
            { from: 'b', to: 'a', condition: 'again' },
            { from: 'b', to: 'done', condition: 'finish' }
          ]
        ),
        { maxIterations: 5 }
      )
    ).not.toThrow()
  })

  it.each([0, -1, 1.5, Number.NaN])(
    'refuses maxIterations of %s',
    maxIterations => {
      expect(() => compileGraph(linear(), { maxIterations })).toThrow(
        /maxIterations must be a positive integer/
      )
    }
  )

  it.each(['provider', 'model', 'tools', 'memory', 'signal'] as const)(
    'refuses to run without deps.%s',
    async missing => {
      const compiled = compileGraph(linear(), { maxIterations: 5 })

      await expect(
        compiled.invoke(context(), { ...DEPS, [missing]: undefined })
      ).rejects.toBeInstanceOf(GraphInvalidError)
    }
  )
})

describe('the event stream', () => {
  it('brackets each node and emits nothing else', async () => {
    const compiled = compileGraph(linear(), { maxIterations: 5 })

    expect(shapeOf(await eventsOf(compiled.stream(context(), DEPS)))).toEqual([
      'node.started(a)',
      'node.completed(a)',
      'node.started(b)',
      'node.completed(b)'
    ])
  })

  it('carries what the node emitted, in emission order, between them', async () => {
    const emitting = node('a', deps => {
      deps.emit({
        type: 'llm.token',
        executionId: 'e1',
        data: { token: 'one' }
      })
      deps.emit({
        type: 'llm.token',
        executionId: 'e1',
        data: { token: 'two' }
      })

      return { stateUpdate: {} }
    })

    const compiled = compileGraph(graphOf([emitting], []), { maxIterations: 5 })
    const events = await eventsOf(compiled.stream(context(), DEPS))

    expect(events.map(event => event.type)).toEqual([
      'node.started',
      'llm.token',
      'llm.token',
      'node.completed'
    ])
    expect(
      events
        .filter(event => event.type === 'llm.token')
        .map(event => dataOf(event)['token'])
    ).toEqual(['one', 'two'])
  })

  it('emits no execution event, which belongs a layer up', async () => {
    const compiled = compileGraph(linear(), { maxIterations: 5 })
    const events = await eventsOf(compiled.stream(context(), DEPS))

    expect(events.some(event => event.type.startsWith('execution.'))).toBe(
      false
    )
  })

  it('carries only its own executionId when two invocations overlap', async () => {
    const compiled = compileGraph(linear(), { maxIterations: 5 })
    const [first, second] = await Promise.all([
      eventsOf(compiled.stream(context({ executionId: 'one' }), DEPS)),
      eventsOf(compiled.stream(context({ executionId: 'two' }), DEPS))
    ])

    expect(first?.every(event => event.executionId === 'one')).toBe(true)
    expect(second?.every(event => event.executionId === 'two')).toBe(true)
  })
})

describe('invoke', () => {
  it('emits what stream emits and resolves to the last state', async () => {
    const graph = graphOf(
      [
        node('a', () => ({ stateUpdate: { output: 'a' } })),
        node('b', () => ({ stateUpdate: { output: 'ab' } }))
      ],
      [{ from: 'a', to: 'b' }]
    )
    const compiled = compileGraph(graph, { maxIterations: 5 })

    const streamed = shapeOf(await eventsOf(compiled.stream(context(), DEPS)))
    const state = await compiled.invoke(context(), DEPS)

    expect(streamed).toEqual([
      'node.started(a)',
      'node.completed(a)',
      'node.started(b)',
      'node.completed(b)'
    ])
    expect(state['output']).toBe('ab')
  })

  it('hands the drained run its own state without stepping again', async () => {
    let ran = 0
    const graph = graphOf(
      [
        node('a', () => {
          ran += 1

          return { stateUpdate: { output: 'a' } }
        }),
        node('b', () => {
          ran += 1

          return { stateUpdate: { output: 'ab' } }
        })
      ],
      [{ from: 'a', to: 'b' }]
    )
    const run = compileGraph(graph, { maxIterations: 5 }).stream(
      context(),
      DEPS
    )

    await eventsOf(run)

    await expect(run.state()).resolves.toMatchObject({ output: 'ab' })
    expect(ran).toBe(2)
  })

  it('holds the state as of the last completed node when a route fails', async () => {
    const graph = graphOf(
      [
        node('a', () => ({ stateUpdate: {}, nextNode: 'ghost' })),
        node('b'),
        node('c')
      ],
      [
        { from: 'a', to: 'b', condition: 'onward' },
        { from: 'a', to: 'c', condition: 'aside' }
      ]
    )
    const run = compileGraph(graph, { maxIterations: 5 }).stream(
      context(),
      DEPS
    )

    await expect(eventsOf(run)).rejects.toBeInstanceOf(GraphRouteInvalidError)
    await expect(run.state()).resolves.toMatchObject({ input: 'x' })
  })
})

describe('what a node is handed', () => {
  it('sees the state the node before it wrote, not the seed', async () => {
    const seen: unknown[] = []
    const graph = graphOf(
      [
        node('a', () => ({ stateUpdate: { output: 'from a' } })),
        node('b', (_deps, given) => {
          seen.push(given.state['output'])

          return { stateUpdate: {} }
        })
      ],
      [{ from: 'a', to: 'b' }]
    )

    await compileGraph(graph, { maxIterations: 5 }).invoke(context(), DEPS)

    expect(seen).toEqual(['from a'])
  })

  it('carries the configured model', async () => {
    const seen: string[] = []
    const graph = graphOf(
      [
        node('a', deps => {
          seen.push(deps.model)

          return { stateUpdate: {} }
        })
      ],
      []
    )

    await compileGraph(graph, { maxIterations: 5 }).invoke(context(), DEPS)

    expect(seen).toEqual(['authored'])
  })
})

describe('routing', () => {
  const branching = (): AgentGraph =>
    graphOf(
      [
        node('decision', () => ({ stateUpdate: {}, nextNode: 'tool' })),
        node('tool'),
        node('response')
      ],
      [
        { from: 'decision', to: 'tool', condition: 'needsTool' },
        { from: 'decision', to: 'response', condition: 'answersDirectly' }
      ]
    )

  it('takes the branch the node named and reports its condition', async () => {
    const compiled = compileGraph(branching(), { maxIterations: 5 })

    expect(shapeOf(await eventsOf(compiled.stream(context(), DEPS)))).toEqual([
      'node.started(decision)',
      'node.completed(decision:needsTool)',
      'node.started(tool)',
      'node.completed(tool)'
    ])
  })

  it('takes the other branch of the same graph', async () => {
    const graph = branching()
    const [decision] = graph.nodes
    const compiled = compileGraph(
      {
        ...graph,
        nodes: [
          node(decision?.id ?? 'decision', () => ({
            stateUpdate: {},
            nextNode: 'response'
          })),
          ...graph.nodes.slice(1)
        ]
      },
      { maxIterations: 5 }
    )

    expect(shapeOf(await eventsOf(compiled.stream(context(), DEPS)))).toEqual([
      'node.started(decision)',
      'node.completed(decision:answersDirectly)',
      'node.started(response)',
      'node.completed(response)'
    ])
  })

  it('carries no branch on an unconditional edge', async () => {
    const compiled = compileGraph(linear(), { maxIterations: 5 })
    const events = await eventsOf(compiled.stream(context(), DEPS))
    const [, first] = events

    expect(first === undefined ? undefined : dataOf(first)).toEqual({
      node: 'a'
    })
  })

  it('refuses a nextNode matching no outgoing edge', async () => {
    const graph = graphOf(
      [
        node('a', () => ({ stateUpdate: {}, nextNode: 'nowhere' })),
        node('b'),
        node('c')
      ],
      [
        { from: 'a', to: 'b', condition: 'onward' },
        { from: 'a', to: 'c', condition: 'aside' }
      ]
    )
    const compiled = compileGraph(graph, { maxIterations: 5 })

    await expect(
      eventsOf(compiled.stream(context(), DEPS))
    ).rejects.toBeInstanceOf(GraphRouteInvalidError)
  })

  it('refuses a branch with no nextNode rather than taking the first', async () => {
    const compiled = compileGraph(
      graphOf(
        [node('decision'), node('tool'), node('response')],
        [
          { from: 'decision', to: 'tool', condition: 'needsTool' },
          { from: 'decision', to: 'response', condition: 'answersDirectly' }
        ]
      ),
      { maxIterations: 5 }
    )

    await expect(eventsOf(compiled.stream(context(), DEPS))).rejects.toThrow(
      /returned no nextNode/
    )
  })

  it('is unmoved by the order the edges were declared in', async () => {
    const graph = branching()
    const reversed = compileGraph(
      { ...graph, edges: [...graph.edges].reverse() },
      { maxIterations: 5 }
    )
    const declared = compileGraph(graph, { maxIterations: 5 })

    expect(shapeOf(await eventsOf(reversed.stream(context(), DEPS)))).toEqual(
      shapeOf(await eventsOf(declared.stream(context(), DEPS)))
    )
  })
})

describe('the iteration limit', () => {
  const looping = (): AgentGraph =>
    graphOf(
      [node('a', () => ({ stateUpdate: {}, nextNode: 'a' })), node('done')],
      [
        { from: 'a', to: 'a', condition: 'again' },
        { from: 'a', to: 'done', condition: 'finish' }
      ]
    )

  it('stops a graph that revisits past the budget', async () => {
    const compiled = compileGraph(looping(), { maxIterations: 3 })

    await expect(
      eventsOf(compiled.stream(context(), DEPS))
    ).rejects.toBeInstanceOf(MaxIterationsExceededError)
  })

  it('gives each invocation the full budget', async () => {
    const compiled = compileGraph(linear(), { maxIterations: 2 })

    await expect(compiled.invoke(context(), DEPS)).resolves.toBeDefined()
    await expect(compiled.invoke(context(), DEPS)).resolves.toBeDefined()
  })
})

describe('what a node failure becomes', () => {
  it('propagates a runtime error unchanged', async () => {
    const compiled = compileGraph(
      graphOf(
        [
          node('a', () => {
            throw new ToolError('the tool refused')
          })
        ],
        []
      ),
      { maxIterations: 5 }
    )

    await expect(
      eventsOf(compiled.stream(context(), DEPS))
    ).rejects.toMatchObject({ category: 'tool', code: 'tool_error' })
  })

  it('wraps anything else, naming the node', async () => {
    const compiled = compileGraph(
      graphOf(
        [
          node('a', () => {
            throw new Error('boom')
          })
        ],
        []
      ),
      { maxIterations: 5 }
    )

    await expect(eventsOf(compiled.stream(context(), DEPS))).rejects.toThrow(
      /a failed: boom/
    )
  })

  it('wraps a rejection that is not an Error at all', async () => {
    const compiled = compileGraph(
      graphOf(
        [
          node('a', () => {
            throw 'a bare string'
          })
        ],
        []
      ),
      { maxIterations: 5 }
    )

    await expect(eventsOf(compiled.stream(context(), DEPS))).rejects.toThrow(
      /a failed: a bare string/
    )
  })

  it('refuses a stateUpdate that is not an object', async () => {
    const compiled = compileGraph(
      graphOf(
        [
          node('a', () => ({
            stateUpdate: [] as unknown as Record<string, unknown>
          }))
        ],
        []
      ),
      { maxIterations: 5 }
    )

    await expect(
      eventsOf(compiled.stream(context(), DEPS))
    ).rejects.toBeInstanceOf(AgentError)
  })
})

describe('cancellation', () => {
  it('starts no further node once the signal aborts', async () => {
    const controller = new AbortController()
    const graph = graphOf(
      [
        node('a', () => {
          controller.abort()

          return { stateUpdate: { output: 'a' } }
        }),
        node('b')
      ],
      [{ from: 'a', to: 'b' }]
    )
    const compiled = compileGraph(graph, { maxIterations: 5 })

    expect(
      shapeOf(
        await eventsOf(
          compiled.stream(context(), { ...DEPS, signal: controller.signal })
        )
      )
    ).toEqual(['node.started(a)', 'node.completed(a)'])
  })

  it('resolves invoke with the state as of the last completed node', async () => {
    const controller = new AbortController()
    const graph = graphOf(
      [
        node('a', () => {
          controller.abort()

          return { stateUpdate: { output: 'a' } }
        }),
        node('b', () => ({ stateUpdate: { output: 'b' } }))
      ],
      [{ from: 'a', to: 'b' }]
    )
    const compiled = compileGraph(graph, { maxIterations: 5 })
    const state = await compiled.invoke(context(), {
      ...DEPS,
      signal: controller.signal
    })

    expect(state['output']).toBe('a')
  })

  it('yields nothing at all when the signal is already aborted', async () => {
    const compiled = compileGraph(linear(), { maxIterations: 5 })

    expect(
      await eventsOf(
        compiled.stream(context(), { ...DEPS, signal: AbortSignal.abort() })
      )
    ).toEqual([])
  })
})
