import { AgentAlreadyRegisteredError, AgentError } from '@arl/contracts'

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
  private readonly definitions = new Map<string, AgentDefinition>()

  /**
   * Registration happens at boot, so a duplicate is a composition-root defect.
   * The first definition stands: replacing it silently would make which agent
   * a cell serves depend on module evaluation order.
   */
  register(definition: AgentDefinition): void {
    if (typeof definition.id !== 'string' || definition.id.length === 0) {
      throw new AgentError('an agent must be registered under a non-empty id')
    }

    if (this.definitions.has(definition.id)) {
      throw new AgentAlreadyRegisteredError(
        `an agent with the id ${definition.id} is already registered`
      )
    }

    this.definitions.set(definition.id, definition)
  }

  get(id: string): AgentDefinition | null {
    return this.definitions.get(id) ?? null
  }

  /** Sorted by id, so `GET /agents` answers the same way in all four cells. */
  list(): readonly AgentDefinition[] {
    return [...this.definitions.values()].sort((left, right) =>
      left.id.localeCompare(right.id)
    )
  }
}
