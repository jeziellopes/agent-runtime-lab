import type { Tool } from '@arl/contracts'

/**
 * Registered, never imported by a node directly. An agent with no tools
 * registers none: this one reasons in three steps and calls nothing.
 */
export const tools: Tool[] = []
