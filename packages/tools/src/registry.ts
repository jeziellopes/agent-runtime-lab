import { ToolError } from '@arl/contracts'

import type { Tool, ToolRegistry } from '@arl/contracts'

/**
 * L5. Tools are registered here and resolved by name. A graph node must not
 * import a tool directly.
 */
export class InMemoryToolRegistry implements ToolRegistry {
  private readonly tools = new Map<string, Tool>()

  /**
   * Registration happens at boot, so a duplicate is a composition-root defect
   * rather than a request-time one. The first tool stands: silently replacing
   * it would make which cell wins depend on module evaluation order.
   */
  register(tool: Tool): void {
    if (typeof tool.name !== 'string' || tool.name.length === 0) {
      throw new ToolError('a tool must be registered under a non-empty name')
    }

    if (this.tools.has(tool.name)) {
      throw new ToolError(`a tool named ${tool.name} is already registered`)
    }

    this.tools.set(tool.name, tool)
  }

  get(name: string): Tool | null {
    return this.tools.get(name) ?? null
  }

  /** Sorted by name, so the order is the same in all four cells. */
  list(): readonly Tool[] {
    return [...this.tools.values()].sort((left, right) =>
      left.name.localeCompare(right.name)
    )
  }
}
