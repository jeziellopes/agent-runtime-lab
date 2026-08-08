/**
 * The twelve runtime events. Adding a thirteenth changes the surface.
 *
 * Tool activity is always the paired `tool.started` / `tool.completed`; there
 * is no single `tool.called` event.
 *
 * WAITING has no event of its own, `tool.started` is its observable trigger
 * and `tool.completed` is where it is left.
 */
export const RUNTIME_EVENT_TYPES = [
  'execution.created',
  'execution.started',
  'node.started',
  'node.completed',
  'llm.started',
  'llm.token',
  'llm.completed',
  'tool.started',
  'tool.completed',
  'execution.completed',
  'execution.failed',
  'execution.cancelled'
] as const

export type RuntimeEventType = (typeof RUNTIME_EVENT_TYPES)[number]

/**
 * The stream terminates after one of these and the connection closes. No
 * idle-hold, no `retry:`, no reconnection.
 */
export const TERMINAL_EVENT_TYPES = [
  'execution.completed',
  'execution.failed',
  'execution.cancelled'
] as const satisfies readonly RuntimeEventType[]

export type TerminalEventType = (typeof TERMINAL_EVENT_TYPES)[number]

export function isTerminalEvent(type: RuntimeEventType): boolean {
  return (TERMINAL_EVENT_TYPES as readonly RuntimeEventType[]).includes(type)
}
