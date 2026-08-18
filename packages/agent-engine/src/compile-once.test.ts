import * as graphRuntime from '@arl/graph-runtime'
import { expect, it, vi } from 'vitest'

import { DefaultAgentEngine } from './agent-engine.js'

import type { AgentDefinition, ExecutionRequest } from '@arl/contracts'
import type { GraphDeps } from '@arl/graph-runtime'

vi.mock('@arl/graph-runtime', async importActual => {
  const actual = await importActual<typeof graphRuntime>()

  return { ...actual, compileGraph: vi.fn(actual.compileGraph) }
})

const DEPS = {
  provider: {},
  model: 'authored',
  tools: {},
  memory: {},
  signal: new AbortController().signal
} as GraphDeps

const definition: AgentDefinition = {
  id: 'simple-agent',
  name: 'simple',
  description: 'one node',
  graph: {
    entry: 'only',
    nodes: [
      { id: 'only', execute: () => Promise.resolve({ stateUpdate: {} }) }
    ],
    edges: []
  },
  tools: []
}

const request: ExecutionRequest = {
  agentId: 'simple-agent',
  input: { prompt: 'hello' }
}

it('compiles a graph once per agent, not once per run', async () => {
  const engine = new DefaultAgentEngine()

  engine.register(definition)

  for (const executionId of ['e1', 'e2', 'e3']) {
    await engine.run(engine.createContext(request, executionId), DEPS)
  }

  expect(vi.mocked(graphRuntime.compileGraph)).toHaveBeenCalledTimes(1)
})
