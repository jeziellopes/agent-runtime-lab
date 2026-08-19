import { DefaultAgentEngine } from '@arl/agent-engine'
import { AnthropicProvider, ReplayLLMProvider } from '@arl/llm'
import { InMemoryStore } from '@arl/memory'
import { InMemoryToolRegistry } from '@arl/tools'

import { AgentRuntimeCore } from './agent-runtime-core.js'

import type {
  AgentDefinition,
  LLMProvider,
  RuntimeConfig
} from '@arl/contracts'

/**
 * What every cell's composition root calls, and the whole of what it does.
 *
 * One function rather than four wirings: the four cells differ in their HTTP
 * framework and their JavaScript runtime, and a runtime assembled differently
 * per cell would put an authored difference inside the thing being measured.
 */
export function createRuntime(
  config: RuntimeConfig,
  agents: readonly AgentDefinition[]
): AgentRuntimeCore {
  const engine = new DefaultAgentEngine(undefined, config.maxIterations)
  const tools = new InMemoryToolRegistry()

  for (const agent of agents) {
    engine.register(agent)

    for (const tool of agent.tools) {
      tools.register(tool)
    }
  }

  return new AgentRuntimeCore(config, {
    engine,
    provider: providerFor(config),
    tools,
    memory: new InMemoryStore()
  })
}

/**
 * `live` reaches a real class whose every method throws (ADR-0021). It is a
 * documented dead end rather than a quiet fallback to replay: a benchmark that
 * replayed when it was asked for a live model would publish a number nobody
 * could attribute.
 */
function providerFor(config: RuntimeConfig): LLMProvider {
  return config.llmMode === 'live'
    ? new AnthropicProvider()
    : new ReplayLLMProvider(config.fixtureSet)
}
