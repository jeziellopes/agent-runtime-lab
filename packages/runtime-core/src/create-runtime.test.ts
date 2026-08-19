import { describe, expect, it } from 'vitest'

import { createRuntime } from './create-runtime.js'

import type { AgentDefinition, RuntimeConfig } from '@arl/contracts'

const CONFIG: RuntimeConfig = {
  defaultModel: 'authored',
  maxIterations: 10,
  timeoutMs: 30_000,
  llmMode: 'replay',
  maxRetries: 3,
  deterministic: true,
  fixtureSet: 'contract'
}

const calculator = {
  name: 'calculator',
  description: 'a tool the agent declares',
  execute: () => Promise.resolve(0)
}

function agent(id: string, tools = [calculator]): AgentDefinition {
  return {
    id,
    name: id,
    description: `the ${id}`,
    graph: {
      entry: 'only',
      nodes: [
        {
          id: 'only',
          execute: async (_context, deps) => {
            await deps.provider.countTokens([])

            return { stateUpdate: {} }
          }
        }
      ],
      edges: []
    },
    tools
  }
}

describe('assembling the runtime a cell serves', () => {
  it('registers every agent it is handed', async () => {
    const runtime = createRuntime(CONFIG, [agent('one', []), agent('two', [])])

    await expect(runtime.listAgents()).resolves.toMatchObject([
      { id: 'one' },
      { id: 'two' }
    ])
  })

  it('carries the config through unchanged', () => {
    expect(createRuntime(CONFIG, []).runtimeConfig).toBe(CONFIG)
  })

  it('runs a graph with the tools its agent declared', async () => {
    const runtime = createRuntime(CONFIG, [agent('one')])

    await expect(
      runtime.execute({ agentId: 'one', input: { prompt: 'anything' } })
    ).resolves.toMatchObject({ status: 'completed' })
  })

  it('refuses to start when two agents claim one tool name', () => {
    expect(() => createRuntime(CONFIG, [agent('one'), agent('two')])).toThrow(
      /already registered/
    )
  })

  it('reaches a live provider that throws rather than replaying quietly', async () => {
    const runtime = createRuntime({ ...CONFIG, llmMode: 'live' }, [
      agent('one', [])
    ])

    await expect(
      runtime.execute({ agentId: 'one', input: { prompt: 'anything' } })
    ).rejects.toThrow(/not implemented/)
  })
})
