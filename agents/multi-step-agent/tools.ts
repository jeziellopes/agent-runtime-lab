import { SearchTool } from '@arl/tools'

/**
 * Registered, never imported by a node directly. An agent with no tools
 * registers none.
 */
export const tools = [new SearchTool()]
