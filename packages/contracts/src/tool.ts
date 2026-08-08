/**
 * N -> M `AgentDefinition`. Tools are registered, never imported by a node
 * directly.
 */
export interface Tool {
  name: string
  description: string
  execute(input: unknown): Promise<unknown>
}

export interface ToolRegistry {
  register(tool: Tool): void
  get(name: string): Tool | null
  list(): readonly Tool[]
}
