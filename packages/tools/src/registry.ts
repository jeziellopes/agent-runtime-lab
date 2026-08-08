import type { Tool, ToolRegistry } from '@arl/contracts'

/**
 * L5. Tools are registered here and resolved by name. A graph node must not
 * import a tool directly.
 */
export class InMemoryToolRegistry implements ToolRegistry {
  register(_tool: Tool): void {
    throw new Error('InMemoryToolRegistry.register is not implemented')
  }

  get(_name: string): Tool | null {
    throw new Error('InMemoryToolRegistry.get is not implemented')
  }

  list(): readonly Tool[] {
    throw new Error('InMemoryToolRegistry.list is not implemented')
  }
}
