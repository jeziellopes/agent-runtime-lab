import type { Tool } from '@arl/contracts'

/**
 * Registered, never imported by a node directly. An agent with no tools
 * registers none.
 */
export const tools: Tool[] = []
