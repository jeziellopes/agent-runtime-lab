import type { AgentDefinition } from '@arl/contracts'

/**
 * L3. Agents are registered, never imported by the runtime by name:
 * `runtime.registerAgent({ id: 'new-agent', graph })`.
 *
 * The same definition runs in every cell, always.
 */
export interface AgentRegistry {
  register(definition: AgentDefinition): void
  get(id: string): AgentDefinition | null
  list(): readonly AgentDefinition[]
}

export class InMemoryAgentRegistry implements AgentRegistry {
  register(_definition: AgentDefinition): void {
    throw new Error('InMemoryAgentRegistry.register is not implemented')
  }

  get(_id: string): AgentDefinition | null {
    throw new Error('InMemoryAgentRegistry.get is not implemented')
  }

  list(): readonly AgentDefinition[] {
    throw new Error('InMemoryAgentRegistry.list is not implemented')
  }
}
